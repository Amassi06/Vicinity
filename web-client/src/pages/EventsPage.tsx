import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useAuth } from '../context/AuthContext.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { useT } from '../i18n/I18nContext.js';
import { useSwipe } from '../hooks/useSwipe.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';

type EventDoc = {
  _id: string;
  title: string;
  description?: string;
  organizerId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  interested: string[];
  declined: string[];
};

type NamedUser = { id: string; displayName: string };
type InterestedView = {
  role: 'admin' | 'habitant';
  total: number;
  interested?: NamedUser[];
  friendsInterested?: NamedUser[];
};

/** Valeur `datetime-local` minimale (maintenant) pour bloquer les dates passées. */
function nowLocalValue(): string {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return now.toISOString().slice(0, 16);
}

export function EventsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const t = useT();
  const [items, setItems] = useState<EventDoc[]>([]);
  const [reco, setReco] = useState<EventDoc[]>([]);
  const [views, setViews] = useState<Record<string, InterestedView>>({});
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const minDate = nowLocalValue();

  const load = useCallback(async () => {
    if (!selectedId) {
      setItems([]);
      setReco([]);
      return;
    }
    setErr(null);
    try {
      const [list, recommendations] = await Promise.all([
        apiFetch<{ items: EventDoc[] }>(`/events?neighbourhoodId=${selectedId}`),
        apiFetch<{ items: EventDoc[] }>(`/events/recommendations?neighbourhoodId=${selectedId}`),
      ]);
      setItems(list.items);
      setReco(recommendations.items);
      const fetched: Record<string, InterestedView> = {};
      await Promise.all(
        list.items.map(async (ev) => {
          try {
            fetched[ev._id] = await apiFetch<InterestedView>(`/events/${ev._id}/interested`);
          } catch {
            /* ignore */
          }
        }),
      );
      setViews(fetched);
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }, [selectedId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!selectedId) return;
    setErr(null);
    try {
      const doc = await apiFetch<{ _id: string }>('/events', {
        method: 'POST',
        json: { neighbourhoodId: selectedId, title, startsAt, endsAt },
      });
      await apiFetch(`/events/${String(doc._id)}/publish`, { method: 'POST' });
      setTitle('');
      setStartsAt('');
      setEndsAt('');
      await load();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setErr(code === 'event_in_past' ? t('events.errorPast') : apiErrorMessage(e, t));
    }
  }

  async function run(action: () => Promise<unknown>): Promise<void> {
    setErr(null);
    try {
      await action();
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }

  const interest = (id: string): Promise<void> =>
    run(() => apiFetch(`/events/${id}/interest`, { method: 'POST' }));
  const decline = (id: string): Promise<void> =>
    run(() => apiFetch(`/events/${id}/decline`, { method: 'POST' }));
  const remove = (id: string): Promise<void> =>
    run(() => apiFetch(`/events/${id}`, { method: 'DELETE' }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('events.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedId ? (
          <p className="text-muted-foreground">{t('common.selectNeighbourhood')}</p>
        ) : (
          <>
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void create(e)}>
              <Input
                className="max-w-56"
                placeholder={t('events.form.title')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Input
                type="datetime-local"
                className="max-w-56"
                min={minDate}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
              <Input
                type="datetime-local"
                className="max-w-56"
                min={startsAt || minDate}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
              <Button type="submit">{t('events.form.publish')}</Button>
            </form>
            {err ? (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ) : null}
            <h2 className="text-lg font-semibold">{t('events.published')}</h2>
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-input p-8 text-center text-muted-foreground">
                {t('events.empty')}
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((ev) => (
                  <EventListItem
                    key={ev._id}
                    ev={ev}
                    t={t}
                    userId={user?.sub}
                    canDelete={isAdmin || ev.organizerId === user?.sub}
                    view={views[ev._id]}
                    onInterest={() => void interest(ev._id)}
                    onDecline={() => void decline(ev._id)}
                    onDelete={() => void remove(ev._id)}
                  />
                ))}
              </ul>
            )}
            {reco.length > 0 ? (
              <>
                <h2 className="text-lg font-semibold">{t('events.recommendations')}</h2>
                <ul className="space-y-2">
                  {reco.map((ev) => (
                    <li
                      key={ev._id}
                      className="rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
                    >
                      {ev.title}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EventListItem({
  ev,
  t,
  userId,
  canDelete,
  view,
  onInterest,
  onDecline,
  onDelete,
}: {
  ev: EventDoc;
  t: (key: string) => string;
  userId: string | undefined;
  canDelete: boolean;
  view: InterestedView | undefined;
  onInterest: () => void;
  onDecline: () => void;
  onDelete: () => void;
}): ReactElement {
  const swipe = useSwipe({ onSwipeLeft: onDecline, onSwipeRight: onInterest });
  const isInterested = !!userId && ev.interested.includes(userId);
  const isDeclined = !!userId && ev.declined.includes(userId);

  const friends = view?.friendsInterested ?? [];
  const friendNames = friends.map((f) => f.displayName);

  return (
    <li
      {...swipe}
      style={{ touchAction: 'pan-y' }}
      className="rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">{ev.title}</strong>
        <Badge variant="secondary">{new Date(ev.startsAt).toLocaleString()}</Badge>
        {isInterested ? <Badge>{t('events.status.interested')}</Badge> : null}
        {isDeclined ? <Badge variant="destructive">{t('events.status.declined')}</Badge> : null}
      </div>

      {view ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {view.role === 'admin' ? (
            <>
              {t('events.interestedCount')} {view.total}
              {view.interested && view.interested.length > 0
                ? ` — ${view.interested.map((u) => u.displayName).join(', ')}`
                : ''}
            </>
          ) : friendNames.length > 0 ? (
            <>
              {friendNames.join(' ' + t('events.and') + ' ')} {t('events.friendsInterested')}
            </>
          ) : (
            <>
              {t('events.interestedCount')} {view.total}
            </>
          )}
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button size="sm" variant={isInterested ? 'default' : 'secondary'} onClick={onInterest}>
          {t('events.interest')}
        </Button>
        <Button size="sm" variant={isDeclined ? 'default' : 'secondary'} onClick={onDecline}>
          {t('events.decline')}
        </Button>
        {canDelete ? (
          <Button size="sm" variant="destructive" onClick={onDelete}>
            {t('events.delete')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
