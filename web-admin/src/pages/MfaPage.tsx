import { FormEvent, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';

export function MfaPage(): ReactElement {
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function enroll(): Promise<void> {
    setErr(null);
    try {
      const res = await apiFetch<{ secret: string; otpauthUri: string }>('/auth/mfa/enroll', {
        method: 'POST',
      });
      setSecret(res.secret);
      setOtpauthUri(res.otpauthUri);
      setMsg('Secret généré — activez avec un code TOTP.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function activate(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    await apiFetch('/auth/mfa/activate', { method: 'POST', json: { token } });
    setMsg('MFA activé.');
  }

  async function disable(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    await apiFetch('/auth/mfa/disable', { method: 'POST', json: { token } });
    setSecret(null);
    setMsg('MFA désactivé.');
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>MFA administrateur</h1>
      <button type="button" className="primary" onClick={() => void enroll()}>
        Enrôler TOTP
      </button>
      {secret ? (
        <pre className="code-out">
          {secret}
          {'\n'}
          {otpauthUri}
        </pre>
      ) : null}
      <form className="inline-form" onSubmit={(e) => void activate(e)}>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Code TOTP" />
        <button type="submit" className="secondary">
          Activer
        </button>
        <button type="button" className="secondary" onClick={(e) => void disable(e)}>
          Désactiver
        </button>
      </form>
      {msg ? <p>{msg}</p> : null}
      {err ? <p className="error-msg">{err}</p> : null}
    </section>
  );
}
