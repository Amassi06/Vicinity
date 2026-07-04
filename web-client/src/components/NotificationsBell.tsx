import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext.js';
import { useT } from '../i18n/I18nContext.js';

/** Bulle de notifications globale + dropdown des non-lus. */
export function NotificationsBell(): ReactElement {
  const { counts, refresh } = useNotifications();
  const navigate = useNavigate();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function go(path: string): void {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t('notifications.title')}
        onClick={() => {
          setOpen((v) => !v);
          void refresh();
        }}
        className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Bell className="size-5" />
        {counts.total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
            {counts.total > 99 ? '99+' : counts.total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          <div className="border-b border-border px-3 py-2 text-sm font-semibold">
            {t('notifications.title')}
          </div>
          {counts.total === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{t('notifications.empty')}</p>
          ) : (
            <ul className="py-1">
              <li>
                <button
                  type="button"
                  onClick={() => go('/messages')}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                >
                  <span>{t('notifications.messages')}</span>
                  <span className="rounded-full bg-destructive/15 px-2 text-xs font-medium text-destructive">
                    {counts.messages}
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => go('/documents')}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                >
                  <span>{t('notifications.documents')}</span>
                  <span className="rounded-full bg-destructive/15 px-2 text-xs font-medium text-destructive">
                    {counts.documents}
                  </span>
                </button>
              </li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
