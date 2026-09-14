import type { AuthResult } from '@kga/contracts';

/**
 * M3 — a thin fetch wrapper. All server state goes through here so auth,
 * the `/api/v1` prefix and token refresh live in exactly one place. (§11.1
 * names TanStack Query; the vertical slice keeps the dependency surface small
 * and adds it in M4 when the reports screens need real caching.)
 */
const BASE = '/api/v1';
const ACCESS_KEY = 'kga.accessToken';
const REFRESH_KEY = 'kga.refreshToken';

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: AuthResult['tokens']): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as AuthResult;
      tokenStore.set(body.tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  retry = true,
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(tokenStore.access ? { authorization: `Bearer ${tokenStore.access}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (res.status === 401 && retry && (await tryRefresh())) {
    return api<T>(path, init, false);
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Fetch a file endpoint (report exports, §12). Same auth + one-shot refresh as
 * `api`, but returns the raw blob and the server-suggested filename.
 */
export async function apiBlob(
  path: string,
  retry = true,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: tokenStore.access ? { authorization: `Bearer ${tokenStore.access}` } : {},
  });
  if (res.status === 401 && retry && (await tryRefresh())) {
    return apiBlob(path, false);
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return { blob: await res.blob(), filename: match?.[1] ?? 'report' };
}
