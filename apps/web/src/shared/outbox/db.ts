import type { SubmitResult } from '@kga/contracts';

/**
 * §11.5 — the result outbox. A rating a teacher has already given must survive a
 * momentary WiFi drop, so every result is written here first and synced in the
 * background. Each row carries a client-generated `clientId`; the API's sync
 * endpoint is idempotent on it, so a retried flush cannot duplicate.
 *
 * Raw IndexedDB rather than Dexie (§11.5) — one object store, three operations.
 */
const DB_NAME = 'kga-outbox';
const STORE = 'results';

export interface OutboxRow {
  /** Primary key — the idempotency key sent to the API. */
  clientId: string;
  result: SubmitResult;
  queuedAt: string;
  attempts: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'clientId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function enqueueResult(result: SubmitResult): Promise<void> {
  const row: OutboxRow = {
    clientId: result.clientId,
    result,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  await tx('readwrite', (store) => store.put(row));
}

export async function allPending(): Promise<OutboxRow[]> {
  return tx('readonly', (store) => store.getAll() as IDBRequest<OutboxRow[]>);
}

export async function removeResults(clientIds: string[]): Promise<void> {
  if (clientIds.length === 0) return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const id of clientIds) store.delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function bumpAttempts(rows: OutboxRow[]): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const row of rows) store.put({ ...row, attempts: row.attempts + 1 });
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
