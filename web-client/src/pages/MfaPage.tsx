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
    setMsg(null);
    try {
      const res = await apiFetch<{ secret: string; otpauthUri: string }>('/auth/mfa/enroll', {
        method: 'POST',
      });
      setSecret(res.secret);
      setOtpauthUri(res.otpauthUri);
      setMsg('Scannez le secret dans votre appli TOTP, puis activez avec un code.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function activate(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    try {
      await apiFetch('/auth/mfa/activate', { method: 'POST', json: { token } });
      setMsg('MFA activé.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function disable(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    try {
      await apiFetch('/auth/mfa/disable', { method: 'POST', json: { token } });
      setSecret(null);
      setOtpauthUri(null);
      setMsg('MFA désactivé.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Authentification à deux facteurs</h1>
      <button type="button" className="primary" onClick={() => void enroll()}>
        Générer un secret TOTP
      </button>
      {secret ? (
        <pre className="code-out">
          {secret}
          {'\n'}
          {otpauthUri}
        </pre>
      ) : null}
      <form className="inline-form" onSubmit={(e) => void activate(e)}>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Code 6 chiffres"
          maxLength={8}
        />
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
