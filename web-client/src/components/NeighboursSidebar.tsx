import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Users } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { useRealtime } from '../context/RealtimeContext.js';
import { useT } from '../i18n/I18nContext.js';
import { Avatar } from './Avatar.js';

type Neighbour = { id: string; displayName: string; online: boolean };

/** Sidebar de droite : habitants du quartier, présence en direct, DM en un clic. */
export function NeighboursSidebar(): ReactElement {
  const { online } = useRealtime();
  const navigate = useNavigate();
  const t = useT();
  const [items, setItems] = useState<Neighbour[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: Neighbour[] }>('/me/neighbours');
      setItems(res.items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isOnline = useCallback(
    (n: Neighbour) => online.has(n.id) || n.online,
    [online],
  );

  // Tri : en ligne d'abord, puis alphabétique.
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const oa = isOnline(a) ? 0 : 1;
        const ob = isOnline(b) ? 0 : 1;
        return oa - ob || a.displayName.localeCompare(b.displayName);
      }),
    [items, isOnline],
  );
  const onlineCount = sorted.filter(isOnline).length;

  function openDm(n: Neighbour): void {
    navigate(`/messages?dm=${n.id}&name=${encodeURIComponent(n.displayName)}`);
  }

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-l border-border/70 bg-card/30 backdrop-blur-md lg:flex">
      <div className="flex h-16 items-center justify-between border-b border-border/70 px-4">
        <span className="text-sm font-semibold">{t('neighbours.title')}</span>
        {onlineCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {onlineCount}
          </span>
        ) : null}
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <Users className="size-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">{t('neighbours.empty')}</p>
          </div>
        ) : (
          sorted.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openDm(n)}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
              title={t('neighbours.message')}
            >
              <Avatar name={n.displayName} seed={n.id} size={30} online={isOnline(n)} />
              <span className="min-w-0 flex-1 truncate">{n.displayName}</span>
              <MessageCircle className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
