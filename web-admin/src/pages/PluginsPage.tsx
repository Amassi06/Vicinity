import { useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';

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
    <Card className="m-6">
      <CardHeader>
        <CardTitle className="text-xl">Plugins Vicinity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Boot (Node)</h2>
          <ul className="space-y-1">
            {boot.map((p) => (
              <li key={p.id}>
                <strong>{p.id}</strong> — {p.description}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Sondages</h2>
          <ul className="space-y-1">
            {polls.map((p) => (
              <li key={p.id}>
                <strong>{p.name ?? p.id}</strong> — {p.description}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
