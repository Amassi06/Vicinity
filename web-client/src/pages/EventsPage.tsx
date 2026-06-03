import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { NeighbourhoodSelect } from '../components/NeighbourhoodSelect.js';

type EventDoc = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  startsAt: string;
  endsAt: string;
};

export function EventsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const [items, setItems] = useState<EventDoc[]>([]);
  const [reco, setReco] = useState<EventDoc[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

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
        apiFetch<{ items: EventDoc[] }>(
          `/events/recommendations?neighbourhoodId=${selectedId}`,
        ),
      ]);
      setItems(list.items);
      setReco(recommendations.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!selectedId) return;
    try {
      const doc = await apiFetch<{ _id: string }>('/events', {
        method: 'POST',
        json: {
          neighbourhoodId: selectedId,
          title,
          startsAt,
          endsAt,
        },
      });
      await apiFetch(`/events/${String(doc._id)}/publish`, { method: 'POST' });
      setTitle('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Création impossible');
    }
  }

  async function interest(id: string): Promise<void> {
    await apiFetch(`/events/${id}/interest`, { method: 'POST' });
    await load();
  }

  async function decline(id: string): Promise<void> {
    await apiFetch(`/events/${id}/decline`, { method: 'POST' });
    await load();
  }

  async function cancel(id: string): Promise<void> {
    await apiFetch(`/events/${id}/cancel`, { method: 'POST' });
    await load();
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Événements</h1>
      <NeighbourhoodSelect />
      {!selectedId ? (
        <p className="muted">Sélectionnez un quartier.</p>
      ) : (
        <>
          <form className="inline-form" onSubmit={(e) => void create(e)}>
            <input
              placeholder="Titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
            <button type="submit" className="primary">
              Publier
            </button>
          </form>
          {err ? <p className="error-msg">{err}</p> : null}
          <h2>Publiés</h2>
          <ul className="item-list">
            {items.map((ev) => (
              <li key={ev._id}>
                <strong>{ev.title}</strong> — {new Date(ev.startsAt).toLocaleString()}
                <button type="button" className="secondary" onClick={() => void interest(ev._id)}>
                  Intéressé
                </button>
                <button type="button" className="secondary" onClick={() => void decline(ev._id)}>
                  Décliner
                </button>
                <button type="button" className="secondary" onClick={() => void cancel(ev._id)}>
                  Annuler
                </button>
              </li>
            ))}
          </ul>
          <h2>Recommandations Neo4j</h2>
          <ul className="item-list">
            {reco.map((ev) => (
              <li key={ev._id}>{ev.title}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
