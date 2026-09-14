import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SubmitResult, SyncBatch, SyncBatchResult } from '@kga/contracts';
import { api } from '../api/client';
import { allPending, bumpAttempts, enqueueResult, removeResults } from './db';

/**
 * §11.5 — owns the background flush of the result outbox. Flushes on: a new
 * result being queued, the browser coming back online, and a slow interval as a
 * catch-all. The API `POST /sessions/sync` is idempotent on `clientId`, so an
 * over-eager flush is harmless.
 */
const FLUSH_INTERVAL_MS = 15_000;
const BATCH_LIMIT = 100;

interface OutboxValue {
  pending: number;
  syncing: boolean;
  /** Write a result to IndexedDB and kick a flush. Resolves once persisted locally. */
  queue: (result: SubmitResult) => Promise<void>;
  flush: () => Promise<void>;
}

const OutboxContext = createContext<OutboxValue | null>(null);

export function OutboxProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const refreshCount = useCallback(async () => {
    setPending((await allPending()).length);
  }, []);

  const flush = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    setSyncing(true);
    try {
      const rows = await allPending();
      if (rows.length === 0) return;
      const batch: SyncBatch = { results: rows.slice(0, BATCH_LIMIT).map((r) => r.result) };
      try {
        const outcome = await api<SyncBatchResult>('/sessions/sync', { method: 'POST', json: batch });
        await removeResults([...outcome.accepted, ...outcome.duplicates]);
      } catch {
        // Network or server error — leave the rows in place, record the attempt.
        await bumpAttempts(rows.slice(0, BATCH_LIMIT));
      }
    } finally {
      running.current = false;
      setSyncing(false);
      await refreshCount();
    }
  }, [refreshCount]);

  const queue = useCallback(
    async (result: SubmitResult) => {
      await enqueueResult(result);
      await refreshCount();
      void flush();
    },
    [flush, refreshCount],
  );

  useEffect(() => {
    void refreshCount();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    void flush();
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }, [flush, refreshCount]);

  const value = useMemo<OutboxValue>(
    () => ({ pending, syncing, queue, flush }),
    [pending, syncing, queue, flush],
  );
  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): OutboxValue {
  const value = useContext(OutboxContext);
  if (!value) throw new Error('useOutbox must be used within OutboxProvider');
  return value;
}
