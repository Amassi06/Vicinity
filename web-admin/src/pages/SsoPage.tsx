import { useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';

export function SsoPage(): ReactElement {
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function issue(): Promise<void> {
    setErr(null);
    try {
      const res = await apiFetch<{ ssoToken: string }>('/auth/sso/issue', { method: 'POST' });
      setToken(res.ssoToken);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>SSO client bureau</h1>
      <p className="muted">Émet un jeton court pour le client JavaFX (5 min).</p>
      <button type="button" className="primary" onClick={() => void issue()}>
        Émettre un jeton SSO
      </button>
      {token ? (
        <pre className="code-out" style={{ userSelect: 'all' }}>
          {token}
        </pre>
      ) : null}
      {err ? <p className="error-msg">{err}</p> : null}
    </section>
  );
}
