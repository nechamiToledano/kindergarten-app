import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResult, LoginRequest, User } from '@kga/contracts';
import { api, tokenStore } from '../api/client';

interface AuthValue {
  user: User | null;
  status: 'loading' | 'authed' | 'anon';
  /** Set when a real user logged in but lacks content-editor access (§13.1). */
  wrongRole: boolean;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * The admin app hosts two surfaces (§14): content authoring (CONTENT_EDITOR)
 * and staff/kindergarten management (KINDERGARTEN_ADMIN, NETWORK_ADMIN). A plain
 * TEACHER has no business here — each surface still enforces its own access on
 * the API (§13.1); this is the front-door gate.
 */
const ADMIN_ROLES: User['role'][] = ['CONTENT_EDITOR', 'KINDERGARTEN_ADMIN', 'NETWORK_ADMIN'];
function isEditor(user: User | null): boolean {
  return user != null && ADMIN_ROLES.includes(user.role);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthValue['status']>('loading');
  const [wrongRole, setWrongRole] = useState(false);

  useEffect(() => {
    if (!tokenStore.access) {
      setStatus('anon');
      return;
    }
    api<User>('/auth/me')
      .then((me) => {
        if (!isEditor(me)) {
          tokenStore.clear();
          setWrongRole(true);
          setStatus('anon');
          return;
        }
        setUser(me);
        setStatus('authed');
      })
      .catch(() => {
        tokenStore.clear();
        setStatus('anon');
      });
  }, []);

  const login = useCallback(async (input: LoginRequest) => {
    const result = await api<AuthResult>('/auth/login', { method: 'POST', json: input });
    if (!isEditor(result.user)) {
      setWrongRole(true);
      throw new Error('לחשבון זה אין גישה לממשק הניהול');
    }
    tokenStore.set(result.tokens);
    setWrongRole(false);
    setUser(result.user);
    setStatus('authed');
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('anon');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, status, wrongRole, login, logout }),
    [user, status, wrongRole, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
