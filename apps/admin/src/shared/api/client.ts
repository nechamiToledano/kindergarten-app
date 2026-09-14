import type { AuthResult } from '@kga/contracts';

/**
 * Thin fetch wrapper — the single place auth, the `/api/v1` prefix and one-shot
 * token refresh live. Mirrors apps/web/src/shared/api/client.ts (§11.1); the
 * admin app is read-heavy CRUD, so still no TanStack Query.
 */
const BASE = '/api/v1';
const ACCESS_KEY = 'kga.admin.accessToken';
const REFRESH_KEY = 'kga.admin.refreshToken';

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
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
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
    let details: unknown;
    try {
      const body = (await res.json()) as { message?: string; details?: unknown };
      if (body.message) message = body.message;
      details = body.details;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, message, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
