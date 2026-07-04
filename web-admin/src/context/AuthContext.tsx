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

/** Espace admin : seuls les rôles staff peuvent ouvrir une session ici. */
const STAFF_ROLES = ['ADMIN', 'MODERATOR'];

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  login: (email: string, password: string, mfaToken?: string) => Promise<void>;
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
      if (!STAFF_ROLES.includes(me.role)) {
        clearStored();
        setUser(null);
      } else {
        setUser({ sub: me.sub, email: me.email, role: me.role });
      }
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

  const login = useCallback(async (email: string, password: string, mfaToken?: string) => {
    const r = await authPostJson<AuthTokensResponse>('/auth/login', { email, password, mfaToken });
    if (!STAFF_ROLES.includes(r.user.role)) {
      throw new Error('forbidden_role');
    }
    persistTokens(r.accessToken, r.refreshToken);
    setUser({ sub: r.user.id, email: r.user.email, role: r.user.role });
  }, []);

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
      logout: logoutCb,
    }),
    [ready, user, login, logoutCb],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth hors provider');
  return v;
}
