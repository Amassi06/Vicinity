import { useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';

type Consents = {
  marketing: boolean;
  analytics: boolean;
  neighbourhood_digest: boolean;
};

export function PrivacyPage(): ReactElement {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [consents, setConsents] = useState<Consents | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ consents: Consents }>('/me/consents')
      .then((r) => setConsents(r.consents))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erreur'));
  }, []);

  async function saveConsents(next: Consents): Promise<void> {
    const res = await apiFetch<{ consents: Consents }>('/me/consents', {
      method: 'PATCH',
      json: next,
    });
    setConsents(res.consents);
  }

  async function exportData(): Promise<void> {
    const data = await apiFetch<Record<string, unknown>>('/me/export');
    setExportJson(JSON.stringify(data, null, 2));
  }

  async function deleteAccount(): Promise<void> {
    if (!window.confirm('Supprimer définitivement votre compte ?')) return;
    await apiFetch('/me/delete-account', { method: 'POST' });
    logout();
    navigate('/login');
  }

  if (!consents) return <p className="muted">Chargement RGPD…</p>;

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Données personnelles (RGPD)</h1>
      <h2>Consentements</h2>
      {(Object.keys(consents) as (keyof Consents)[]).map((key) => (
        <label key={key} style={{ display: 'block', marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={consents[key]}
            onChange={(e) => void saveConsents({ ...consents, [key]: e.target.checked })}
          />{' '}
          {key}
        </label>
      ))}
      <div className="inline-form" style={{ marginTop: 16 }}>
        <button type="button" className="primary" onClick={() => void exportData()}>
          Exporter mes données
        </button>
        <button type="button" className="secondary" onClick={() => void deleteAccount()}>
          Supprimer mon compte
        </button>
      </div>
      {exportJson ? <pre className="code-out">{exportJson}</pre> : null}
      {err ? <p className="error-msg">{err}</p> : null}
    </section>
  );
}
