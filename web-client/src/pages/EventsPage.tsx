import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { nowAsDatetimeLocalValue } from '../lib/datetime.js';
import { useAuth } from '../context/AuthContext.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { useToast } from '../context/ToastContext.js';
import { useT } from '../i18n/I18nContext.js';
import { useSwipe } from '../hooks/useSwipe.js';
import { PageHeader } from '../components/PageHeader.js';
import { EmptyState } from '../components/EmptyState.js';
import { Modal } from '../components/Modal.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { ListSkeleton } from '@/components/ui/skeleton.js';

type NeighbourhoodEvent = {
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

export function EventsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const t = useT();
  const { showToast } = useToast();

  const [events, setEvents] = useState<NeighbourhoodEvent[]>([]);
  const [recommendedEvents, setRecommendedEvents] = useState<NeighbourhoodEvent[]>([]);
  const [interestedViews, setInterestedViews] = useState<Record<string, InterestedView>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Champs de la modale de création
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const minDate = nowAsDatetimeLocalValue();

  const load = useCallback(async () => {
    if (!selectedId) {
      setEvents([]);
      setRecommendedEvents([]);
      setLoading(false);
      return;
    }
    setErrorMessage(null);
    try {
      const [published, recommendations] = await Promise.all([
        apiFetch<{ items: NeighbourhoodEvent[] }>(`/events?neighbourhoodId=${selectedId}`),
        apiFetch<{ items: NeighbourhoodEvent[] }>(
          `/events/recommendations?neighbourhoodId=${selectedId}`,
        ),
      ]);
      setEvents(published.items);
      setRecommendedEvents(recommendations.items);
      const views: Record<string, InterestedView> = {};
      await Promise.all(
        published.items.map(async (event) => {
          try {
            views[event._id] = await apiFetch<InterestedView>(`/events/${event._id}/interested`);
          } catch {
            /* vue facultative : la liste reste utilisable sans elle */
          }
        }),
      );
      setInterestedViews(views);
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  }, [selectedId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(formEvent: FormEvent): Promise<void> {
    formEvent.preventDefault();
    if (!selectedId) return;
    setErrorMessage(null);
    try {
      const created = await apiFetch<{ _id: string }>('/events', {
        method: 'POST',
        json: { neighbourhoodId: selectedId, title, startsAt, endsAt },
      });
      await apiFetch(`/events/${String(created._id)}/publish`, { method: 'POST' });
      setTitle('');
      setStartsAt('');
      setEndsAt('');
      setCreating(false);
      showToast(t('events.created'));
      await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setErrorMessage(code === 'event_in_past' ? t('events.errorPast') : apiErrorMessage(error, t));
    }
  }

  async function run(action: () => Promise<unknown>): Promise<void> {
    setErrorMessage(null);
    try {
      await action();
      await load();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  const markInterested = (eventId: string): Promise<void> =>
    run(() => apiFetch(`/events/${eventId}/interest`, { method: 'POST' }));
  const markDeclined = (eventId: string): Promise<void> =>
    run(() => apiFetch(`/events/${eventId}/decline`, { method: 'POST' }));
  const removeEvent = (eventId: string): Promise<void> =>
    run(() => apiFetch(`/events/${eventId}`, { method: 'DELETE' }));

  return (
    <div>
      <PageHeader
        title={t('events.title')}
        description={t('events.subtitle')}
        action={
          selectedId ? (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('events.new')}
            </Button>
          ) : undefined
        }
      />

      {!selectedId ? (
        <p className="text-muted-foreground">{t('common.selectNeighbourhood')}</p>
      ) : (
        <div className="space-y-6">
          {errorMessage && !creating ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t('events.published')}</h2>
            {loading ? (
              <ListSkeleton />
            ) : events.length === 0 ? (
              <EmptyState icon={CalendarDays} text={t('events.empty')} />
            ) : (
              <ul className="space-y-2">
                {events.map((event) => (
                  <EventListItem
                    key={event._id}
                    event={event}
                    userId={user?.sub}
                    canDelete={isAdmin || event.organizerId === user?.sub}
                    view={interestedViews[event._id]}
                    onInterest={() => void markInterested(event._id)}
                    onDecline={() => void markDeclined(event._id)}
                    onDelete={() => void removeEvent(event._id)}
                  />
                ))}
              </ul>
            )}
          </section>

          {recommendedEvents.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t('events.recommendations')}
              </h2>
              <ul className="space-y-2">
                {recommendedEvents.map((event) => (
                  <li
                    key={event._id}
                    className="rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
                  >
                    {event.title}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      {creating ? (
        <Modal title={t('events.new')} onClose={() => setCreating(false)}>
          <form className="space-y-3" onSubmit={(formEvent) => void create(formEvent)}>
            <div className="space-y-1.5">
              <Label htmlFor="event-title">{t('events.form.title')}</Label>
              <Input
                id="event-title"
                value={title}
                onChange={(changeEvent) => setTitle(changeEvent.target.value)}
                required
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-starts">{t('events.form.startsAt')}</Label>
                <Input
                  id="event-starts"
                  type="datetime-local"
                  className="w-56"
                  min={minDate}
                  value={startsAt}
                  onChange={(changeEvent) => setStartsAt(changeEvent.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-ends">{t('events.form.endsAt')}</Label>
                <Input
                  id="event-ends"
                  type="datetime-local"
                  className="w-56"
                  min={startsAt || minDate}
                  value={endsAt}
                  onChange={(changeEvent) => setEndsAt(changeEvent.target.value)}
                  required
                />
              </div>
            </div>
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('events.form.publish')}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function EventListItem({
  event,
  userId,
  canDelete,
  view,
  onInterest,
  onDecline,
  onDelete,
}: {
  event: NeighbourhoodEvent;
  userId: string | undefined;
  canDelete: boolean;
  view: InterestedView | undefined;
  onInterest: () => void;
  onDecline: () => void;
  onDelete: () => void;
}): ReactElement {
  const t = useT();
  const swipe = useSwipe({ onSwipeLeft: onDecline, onSwipeRight: onInterest });
  const isInterested = !!userId && event.interested.includes(userId);
  const isDeclined = !!userId && event.declined.includes(userId);

  const friendNames = (view?.friendsInterested ?? []).map((friend) => friend.displayName);

  return (
    <li
      {...swipe}
      style={{ touchAction: 'pan-y' }}
      className="rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">{event.title}</strong>
        <Badge variant="secondary">{new Date(event.startsAt).toLocaleString()}</Badge>
        {isInterested ? <Badge>{t('events.status.interested')}</Badge> : null}
        {isDeclined ? <Badge variant="destructive">{t('events.status.declined')}</Badge> : null}
      </div>

      {view ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {view.role === 'admin' ? (
            <>
              {t('events.interestedCount')} {view.total}
              {view.interested && view.interested.length > 0
                ? ` — ${view.interested.map((person) => person.displayName).join(', ')}`
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
