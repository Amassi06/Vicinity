import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';

type Neighbourhood = { id: string; name: string };

type Listing = {
  _id: string;
  title: string;
  kind: string;
  category: string;
  pricePoints: number;
  status: string;
  authorId: string;
  contractId?: string | null;
  createdAt?: string;
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  in_progress: 'En cours',
  closed: 'Terminée',
  cancelled: 'Annulée',
};

export function ListingsAdminPage(): ReactElement {
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);
  const [neighbourhoodId, setNeighbourhoodId] = useState('');
  const [items, setItems] = useState<Listing[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Neighbourhood[]>('/neighbourhoods')
      .then((rows) => {
        setNeighbourhoods(rows.map(({ id, name }) => ({ id, name })));
        if (rows.length > 0) setNeighbourhoodId((prev) => prev || rows[0]!.id);
      })
      .catch(() => setNeighbourhoods([]));
  }, []);

  const load = useCallback(async () => {
    if (!neighbourhoodId) {
      setItems([]);
      return;
    }
    setErr(null);
    try {
      const res = await apiFetch<{ items: Listing[] }>(
        `/listings?neighbourhoodId=${neighbourhoodId}`,
      );
      setItems(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }, [neighbourhoodId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string): Promise<void> {
    if (!window.confirm('Supprimer définitivement cette annonce ? Un éventuel séquestre sera remboursé au payeur.')) {
      return;
    }
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/listings/${id}`, { method: 'DELETE' });
      setMsg('Annonce supprimée.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <Card className="m-6">
      <CardHeader>
        <CardTitle className="text-xl">Annonces</CardTitle>
        <CardDescription>
          Modération : les administrateurs peuvent supprimer n'importe quelle annonce.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={neighbourhoodId} onValueChange={setNeighbourhoodId}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="— Quartier —" />
          </SelectTrigger>
          <SelectContent>
            {neighbourhoods.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {msg ? <p>{msg}</p> : null}
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
        {items.length === 0 ? (
          <p className="text-muted-foreground">Aucune annonce pour ce quartier.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((l) => (
              <li
                key={l._id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 p-3"
              >
                <strong className="text-sm">{l.title}</strong>
                <Badge variant="secondary">{l.kind === 'offer' ? 'Offre' : 'Demande'}</Badge>
                <Badge variant="outline">{l.category}</Badge>
                <Badge variant={l.status === 'open' ? 'success' : 'secondary'}>
                  {STATUS_LABELS[l.status] ?? l.status}
                </Badge>
                <span className="text-sm text-muted-foreground">{l.pricePoints} pts</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => void remove(l._id)}
                >
                  Supprimer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
