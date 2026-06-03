import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { NeighbourhoodSelect } from '../components/NeighbourhoodSelect.js';

type PollDoc = {
  _id: string;
  title: string;
  options: string[];
  status: string;
  pluginId?: string;
};

type PluginInfo = { id: string; name: string; description: string };

export function PollsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const [items, setItems] = useState<PollDoc[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [optA, setOptA] = useState('Oui');
  const [optB, setOptB] = useState('Non');
  const [optC, setOptC] = useState('Abstention');
  const [pluginId, setPluginId] = useState('standard');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ polls: PluginInfo[] }>('/plugins')
      .then((r) => setPlugins(r.polls))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) {
      setItems([]);
      return;
    }
    try {
      const res = await apiFetch<{ items: PollDoc[] }>(`/polls?neighbourhoodId=${selectedId}`);
      setItems(res.items);
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
    const options =
      pluginId === 'min-three-options' ? [optA, optB, optC] : [optA, optB].filter(Boolean);
    try {
      await apiFetch('/polls', {
        method: 'POST',
        json: { neighbourhoodId: selectedId, title, options, pluginId },
      });
      setTitle('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function vote(pollId: string, choiceIndex: number): Promise<void> {
    await apiFetch(`/polls/${pollId}/vote`, { method: 'POST', json: { choiceIndex } });
    await load();
  }

  async function showResults(pollId: string): Promise<void> {
    const res = await apiFetch<{
      tallies: Record<string, number>;
      totalVotes: number;
      pluginResults?: Record<string, unknown>;
    }>(`/polls/${pollId}`);
    setDetail(
      JSON.stringify(
        { tallies: res.tallies, totalVotes: res.totalVotes, pluginResults: res.pluginResults },
        null,
        2,
      ),
    );
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Sondages</h1>
      <NeighbourhoodSelect />
      {!selectedId ? (
        <p className="muted">Sélectionnez un quartier.</p>
      ) : (
        <>
          <form className="inline-form" onSubmit={(e) => void create(e)}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Question" required />
            <select value={pluginId} onChange={(e) => setPluginId(e.target.value)}>
              {plugins.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {!plugins.length ? <option value="standard">standard</option> : null}
            </select>
            <input value={optA} onChange={(e) => setOptA(e.target.value)} placeholder="Option A" />
            <input value={optB} onChange={(e) => setOptB(e.target.value)} placeholder="Option B" />
            {pluginId === 'min-three-options' ? (
              <input value={optC} onChange={(e) => setOptC(e.target.value)} placeholder="Option C" />
            ) : null}
            <button type="submit" className="primary">
              Créer
            </button>
          </form>
          {err ? <p className="error-msg">{err}</p> : null}
          <ul className="item-list">
            {items.map((p) => (
              <li key={p._id}>
                <strong>{p.title}</strong> ({p.pluginId ?? 'standard'}, {p.status})
                <div className="row-actions">
                  {p.options.map((o, i) => (
                    <button key={o} type="button" className="secondary" onClick={() => void vote(p._id, i)}>
                      {o}
                    </button>
                  ))}
                  <button type="button" className="secondary" onClick={() => void showResults(p._id)}>
                    Résultats
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {detail ? <pre className="code-out">{detail}</pre> : null}
        </>
      )}
    </section>
  );
}
