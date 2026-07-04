import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch, getAccessToken } from '../lib/api.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';

type DocRow = { _id: string; title: string; status: string };

export function DocumentsAdminPage(): ReactElement {
  const [items, setItems] = useState<DocRow[]>([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<{ items: DocRow[] }>('/documents');
    setItems(res.items);
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : 'Erreur'));
  }, [load]);

  async function upload(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      body: fd,
    });
    if (!res.ok) {
      setErr('Échec upload');
      return;
    }
    setTitle('');
    await load();
  }

  return (
    <Card className="m-6">
      <CardHeader>
        <CardTitle className="text-xl">Documents PDF (admin)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void upload(e)}>
          <Input className="max-w-56" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" required />
          <Input
            type="file"
            className="max-w-56"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button type="submit">Téléverser</Button>
        </form>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-input p-8 text-center text-muted-foreground">
            Aucun document pour l'instant.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((d) => (
              <li
                key={d._id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
              >
                <span className="font-medium">{d.title}</span>
                <Badge variant="secondary">{d.status}</Badge>
              </li>
            ))}
          </ul>
        )}
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
