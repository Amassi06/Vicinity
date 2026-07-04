import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';

type Category = { id: string; slug: string; label: string; createdAt: string };

export function CategoriesAdminPage(): ReactElement {
  const [items, setItems] = useState<Category[]>([]);
  const [label, setLabel] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: Category[] }>('/listing-categories');
      setItems(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/admin/listing-categories', { method: 'POST', json: { label } });
      setLabel('');
      setMsg('Catégorie créée.');
      await load();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Erreur';
      setErr(m === 'slug_already_used' ? 'Cette catégorie existe déjà.' : m);
    }
  }

  async function remove(id: string): Promise<void> {
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/admin/listing-categories/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <Card className="m-6">
      <CardHeader>
        <CardTitle className="text-xl">Catégories d'annonces</CardTitle>
        <CardDescription>
          Référentiel des catégories proposées aux habitants à la création d'une annonce.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void create(e)}>
          <Input
            className="max-w-64"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nom de la catégorie (ex. Jardinage)"
            required
          />
          <Button type="submit">Créer</Button>
        </form>
        {msg ? <p>{msg}</p> : null}
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
        {items.length === 0 ? (
          <p className="text-muted-foreground">Aucune catégorie. Les habitants ne peuvent pas créer d'annonce tant qu'il n'en existe pas.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 p-3"
              >
                <strong className="text-sm">{c.label}</strong>
                <Badge variant="secondary">{c.slug}</Badge>
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => void remove(c.id)}
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
