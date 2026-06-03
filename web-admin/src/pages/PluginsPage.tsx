import { useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';

type PluginRow = { id: string; name?: string; description: string };

export function PluginsPage(): ReactElement {
  const [boot, setBoot] = useState<PluginRow[]>([]);
  const [polls, setPolls] = useState<PluginRow[]>([]);

  useEffect(() => {
    void apiFetch<{ boot: PluginRow[]; polls: PluginRow[] }>('/plugins').then((r) => {
      setBoot(r.boot);
      setPolls(r.polls);
    });
  }, []);

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Plugins Vicinity</h1>
      <h2>Boot (Node)</h2>
      <ul>
        {boot.map((p) => (
          <li key={p.id}>
            <strong>{p.id}</strong> — {p.description}
          </li>
        ))}
      </ul>
      <h2>Sondages</h2>
      <ul>
        {polls.map((p) => (
          <li key={p.id}>
            <strong>{p.name ?? p.id}</strong> — {p.description}
          </li>
        ))}
      </ul>
    </section>
  );
}
