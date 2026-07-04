import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from './AuthContext.js';
import { useRealtime } from './RealtimeContext.js';

export type NotificationCounts = { messages: number; documents: number; total: number };

type NotificationsValue = {
  counts: NotificationCounts;
  refresh: () => Promise<void>;
};

const EMPTY: NotificationCounts = { messages: 0, documents: 0, total: 0 };

const Ctx = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }): ReactElement {
  const { user } = useAuth();
  const { onMessage } = useRealtime();
  const [counts, setCounts] = useState<NotificationCounts>(EMPTY);

  const refresh = useCallback(async () => {
    if (!user) {
      setCounts(EMPTY);
      return;
    }
    try {
      setCounts(await apiFetch<NotificationCounts>('/me/notifications'));
    } catch {
      /* garde les compteurs précédents */
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Un nouveau message qui n'est pas de moi rafraîchit les compteurs.
  useEffect(() => {
    return onMessage((payload) => {
      if (payload['senderId'] !== user?.sub) void refresh();
    });
  }, [onMessage, refresh, user]);

  // Filet de sécurité : rafraîchissement périodique léger.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, [user, refresh]);

  const value = useMemo((): NotificationsValue => ({ counts, refresh }), [counts, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNotifications hors provider');
  return v;
}
