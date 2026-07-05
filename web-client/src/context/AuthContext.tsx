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
  getRefreshToken,
  logout as clearStored,
  setTokens as persistTokens,
  type AuthTokensResponse,
} from '../lib/api.js';

type MePayload = {
  sub: string;
  email: string;
  displayName: string;
  role: string;
  mfa?: boolean;
  neighbourhoodId: string | null;
  neighbourhoodName: string | null;
};

/** Espace habitant : les comptes staff se connectent sur le back-office, pas ici. */
const STAFF_ROLES = ['ADMIN', 'MODERATOR'];

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  login: (email: string, password: string, mfaToken?: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    neighbourhoodId: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthContextValue | null>(null);

function toAuthUser(me: MePayload): AuthUser {
  return {
    sub: me.sub,
    email: me.email,
    displayName: me.displayName,
    role: me.role,
    neighbourhoodId: me.neighbourhoodId,
    neighbourhoodName: me.neighbourhoodName,
  };
}

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
      if (STAFF_ROLES.includes(me.role)) {
        clearStored();
        setUser(null);
      } else {
        setUser(toAuthUser(me));
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
    if (STAFF_ROLES.includes(r.user.role)) {
      throw new Error('forbidden_role');
    }
    persistTokens(r.accessToken, r.refreshToken);
    const me = await apiFetch<MePayload>('/auth/me');
    setUser(toAuthUser(me));
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string, neighbourhoodId: string) => {
      const r = await authPostJson<AuthTokensResponse>('/auth/signup', {
        email,
        password,
        displayName,
        neighbourhoodId,
      });
      persistTokens(r.accessToken, r.refreshToken);
      const me = await apiFetch<MePayload>('/auth/me');
      setUser(toAuthUser(me));
    },
    [],
  );

  const logoutCb = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authPostJson('/auth/logout', { refreshToken });
      } catch {
        /* la session locale est effacée même si le serveur ne répond pas */
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
      refreshUser: hydrate,
    }),
    [ready, user, login, register, logoutCb, hydrate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth hors provider');
  return v;
}
