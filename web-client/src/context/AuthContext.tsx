import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthUser } from '../lib/api.js';
import {
  apiFetch,
  authPostJson,
  getAccessToken,
  logout as clearStored,
  setTokens as persistTokens,
  type AuthTokensResponse,
} from '../lib/api.js';

type MePayload = AuthUser & { mfa?: boolean };

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const hydrate = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const me = await apiFetch<MePayload>('/auth/me');
      setUser({ sub: me.sub, email: me.email, role: me.role });
    } catch {
      clearStored();
      setUser(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onFocus = (): void => {
      if (getAccessToken()) void hydrate();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await authPostJson<AuthTokensResponse>('/auth/login', { email, password });
    persistTokens(r.accessToken, r.refreshToken);
    setUser({ sub: r.user.id, email: r.user.email, role: r.user.role });
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const r = await authPostJson<AuthTokensResponse>('/auth/signup', {
        email,
        password,
        displayName,
      });
      persistTokens(r.accessToken, r.refreshToken);
      setUser({ sub: r.user.id, email: r.user.email, role: r.user.role });
    },
    [],
  );

  const logoutCb = useCallback(async () => {
    const rt = sessionStorage.getItem('vicinity_refresh');
    if (rt) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch {
        /* ignore */
      }
    }
    clearStored();
    setUser(null);
  }, []);

  const value = useMemo(
    (): AuthContextValue => ({
      ready,
      user,
      login,
      register,
      logout: logoutCb,
    }),
    [ready, user, login, register, logoutCb],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth hors provider');
  return v;
}
