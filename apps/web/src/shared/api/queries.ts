import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChildListQuery, SubdomainQuery, UpdateChild } from '@kga/contracts';
import * as apiEndpoints from './endpoints';

/**
 * Server state.
 *
 * The split the app follows: anything that lives in the database is a query key
 * here and is never copied into React state; component state holds only what is
 * genuinely local (which tab is open, what is half-typed in a form). The
 * previous screens each kept their own `useState` copy of a fetch plus a manual
 * `reload()`, so two screens showing the same child could disagree, and every
 * navigation refetched from scratch.
 *
 * Deliberately no client-side store beyond this. There is no application state
 * that is both shared and not server-owned.
 */

export const queryKeys = {
  summary: ['summary'] as const,
  children: (query: Partial<ChildListQuery>) => ['children', query] as const,
  childOverview: (id: string) => ['child', id, 'overview'] as const,
  domains: ['domains'] as const,
  subdomains: (query: SubdomainQuery) => ['subdomains', query] as const,
  session: (id: string) => ['session', id] as const,
  progression: (id: string) => ['reports', 'progression', id] as const,
  vsGroup: (id: string) => ['reports', 'vs-group', id] as const,
  reportSubdomains: ['reports', 'subdomains'] as const,
  patterns: (id: string) => ['reports', 'patterns', id] as const,
};

export function useKindergartenSummary() {
  return useQuery({ queryKey: queryKeys.summary, queryFn: apiEndpoints.getKindergartenSummary });
}

export function useChildren(query: Partial<ChildListQuery>) {
  return useQuery({
    queryKey: queryKeys.children(query),
    queryFn: () => apiEndpoints.listChildren(query),
    // Keeps the previous page on screen while the next one loads, so typing in
    // the search box does not blank the roster on every keystroke.
    placeholderData: (previous) => previous,
  });
}

export function useChildOverview(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.childOverview(id ?? ''),
    queryFn: () => apiEndpoints.getChildOverview(id!),
    enabled: !!id,
  });
}

export function useDomains() {
  return useQuery({
    queryKey: queryKeys.domains,
    queryFn: apiEndpoints.listDomains,
    // The content catalogue changes when an editor publishes, not while a
    // teacher works, so it is worth holding for the session.
    staleTime: 10 * 60_000,
  });
}

export function useSubdomains(query: SubdomainQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.subdomains(query),
    queryFn: () => apiEndpoints.listSubdomains(query),
    staleTime: 10 * 60_000,
    enabled,
  });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.session(id ?? ''),
    queryFn: () => apiEndpoints.getSession(id!),
    enabled: !!id,
  });
}

export function useProgression(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.progression(id ?? ''),
    queryFn: () => apiEndpoints.getProgression(id!),
    enabled: !!id,
  });
}

export function useVsGroup(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.vsGroup(id ?? ''),
    queryFn: () => apiEndpoints.getVsGroup(id!),
    enabled: !!id,
  });
}

export function useReportSubdomains() {
  return useQuery({
    queryKey: queryKeys.reportSubdomains,
    queryFn: apiEndpoints.listReportSubdomains,
  });
}

export function usePatterns(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patterns(id ?? ''),
    queryFn: () => apiEndpoints.getPatterns(id!),
    enabled: !!id,
  });
}

/**
 * Anything that changes a child invalidates the roster, the dashboard and that
 * child's workspace together — those three views are different projections of
 * the same rows, and letting one go stale is how a teacher ends up seeing a
 * child they just edited under their old name.
 */
function useChildInvalidation() {
  const client = useQueryClient();
  return (childId?: string) => {
    void client.invalidateQueries({ queryKey: ['children'] });
    void client.invalidateQueries({ queryKey: queryKeys.summary });
    if (childId) void client.invalidateQueries({ queryKey: ['child', childId] });
  };
}

export function useCreateChild() {
  const invalidate = useChildInvalidation();
  return useMutation({
    mutationFn: apiEndpoints.createChild,
    onSuccess: (child) => invalidate(child.id),
  });
}

export function useUpdateChild() {
  const invalidate = useChildInvalidation();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateChild }) =>
      apiEndpoints.updateChild(id, body),
    onSuccess: (child) => invalidate(child.id),
  });
}

export function useDeleteChild() {
  const invalidate = useChildInvalidation();
  return useMutation({
    mutationFn: apiEndpoints.deleteChild,
    onSuccess: () => invalidate(),
  });
}

/** The follow-up flag — its own mutation so a row can toggle it in place. */
export function useToggleWatch() {
  const invalidate = useChildInvalidation();
  return useMutation({
    mutationFn: ({ id, watch }: { id: string; watch: boolean }) =>
      apiEndpoints.updateChild(id, { watch }),
    onSuccess: (child) => invalidate(child.id),
  });
}

export function useCreateSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: apiEndpoints.createSession,
    onSuccess: (session) => {
      client.setQueryData(queryKeys.session(session.id), session);
      void client.invalidateQueries({ queryKey: queryKeys.summary });
      void client.invalidateQueries({ queryKey: ['child', session.childId] });
    },
  });
}

/**
 * Ending a session — completed or abandoned — refreshes everything that counts
 * sessions. Both paths share this, because a sitting the teacher walked away
 * from has to leave the dashboard's "active now" figure just as surely as a
 * finished one.
 */
function useSessionClosure(mutationFn: (id: string) => ReturnType<typeof apiEndpoints.completeSession>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (session) => {
      client.setQueryData(queryKeys.session(session.id), session);
      void client.invalidateQueries({ queryKey: queryKeys.summary });
      void client.invalidateQueries({ queryKey: ['children'] });
      void client.invalidateQueries({ queryKey: ['child', session.childId] });
    },
  });
}

export const useCompleteSession = () => useSessionClosure(apiEndpoints.completeSession);
export const useAbandonSession = () => useSessionClosure(apiEndpoints.abandonSession);

export function useSkipPlanItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, subdomainId }: { id: string; subdomainId: string }) =>
      apiEndpoints.skipPlanItem(id, subdomainId),
    onSuccess: (session) => client.setQueryData(queryKeys.session(session.id), session),
  });
}
