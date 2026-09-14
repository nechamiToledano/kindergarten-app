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
  login: (input: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthValue['status']>('loading');

  useEffect(() => {
    if (!tokenStore.access) {
      setStatus('anon');
      return;
    }
    api<User>('/auth/me')
      .then((me) => {
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
    tokenStore.set(result.tokens);
    setUser(result.user);
    setStatus('authed');
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('anon');
  }, []);

  const value = useMemo<AuthValue>(() => ({ user, status, login, logout }), [user, status, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
