import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch, getAccessToken } from '../lib/api.js';

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
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Documents PDF (admin)</h1>
      <form className="inline-form" onSubmit={(e) => void upload(e)}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" required />
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="submit" className="primary">
          Téléverser
        </button>
      </form>
      <ul className="item-list">
        {items.map((d) => (
          <li key={d._id}>
            {d.title} — {d.status}
          </li>
        ))}
      </ul>
      {err ? <p className="error-msg">{err}</p> : null}
    </section>
  );
}
