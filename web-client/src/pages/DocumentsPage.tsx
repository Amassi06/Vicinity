import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch, getAccessToken } from '../lib/api.js';

type DocRow = {
  _id: string;
  title: string;
  status: string;
};

export function DocumentsPage(): ReactElement {
  const [items, setItems] = useState<DocRow[]>([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signToken, setSignToken] = useState('');
  const [zoneIndex, setZoneIndex] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: DocRow[] }>('/documents');
      setItems(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!file) {
      setErr('Choisissez un PDF.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      body: fd,
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setErr(data.error ?? res.statusText);
      return;
    }
    setTitle('');
    setFile(null);
    setMsg('Document téléversé.');
    await load();
  }

  async function sign(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!selectedId) return;
    try {
      await apiFetch(`/documents/${selectedId}/zones/${zoneIndex}/sign`, {
        method: 'POST',
        json: { token: signToken },
      });
      setMsg('Zone signée.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur signature');
    }
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Documents PDF</h1>
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
            <button type="button" className="linkish" onClick={() => setSelectedId(d._id)}>
              {d.title}
            </button>{' '}
            — {d.status}{' '}
            <a href={`/api/documents/${d._id}/file`} target="_blank" rel="noreferrer">
              PDF
            </a>
          </li>
        ))}
      </ul>
      {selectedId ? (
        <form className="inline-form" onSubmit={(e) => void sign(e)}>
          <span>Signer doc {selectedId.slice(-6)} zone</span>
          <input
            type="number"
            min={0}
            value={zoneIndex}
            onChange={(e) => setZoneIndex(Number(e.target.value))}
          />
          <input
            value={signToken}
            onChange={(e) => setSignToken(e.target.value)}
            placeholder="TOTP 6 chiffres"
            maxLength={6}
          />
          <button type="submit" className="secondary">
            Signer
          </button>
        </form>
      ) : null}
      {msg ? <p>{msg}</p> : null}
      {err ? <p className="error-msg">{err}</p> : null}
    </section>
  );
}
