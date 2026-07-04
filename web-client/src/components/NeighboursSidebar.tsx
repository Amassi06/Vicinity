import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { useRealtime } from '../context/RealtimeContext.js';
import { useT } from '../i18n/I18nContext.js';
import { cn } from '@/lib/utils.js';

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

  function openDm(n: Neighbour): void {
    navigate(`/messages?dm=${n.id}&name=${encodeURIComponent(n.displayName)}`);
  }

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-l border-border bg-background lg:flex">
      <div className="flex h-14 items-center border-b border-border px-4 text-sm font-semibold">
        {t('neighbours.title')}
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">{t('neighbours.empty')}</p>
        ) : (
          items.map((n) => {
            const isOnline = online.has(n.id) || n.online;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => openDm(n)}
                className="group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
                title={t('neighbours.message')}
              >
                <span className="relative flex size-2.5 shrink-0">
                  <span
                    className={cn(
                      'size-2.5 rounded-full',
                      isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                    )}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate">{n.displayName}</span>
                <MessageCircle className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
