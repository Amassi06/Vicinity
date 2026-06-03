import { FormEvent, useState, type ReactElement } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function RegisterPage(): ReactElement {
  const nav = useNavigate();
  const { user, register } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    try {
      await register(email.trim(), password, displayName.trim());
      nav('/');
    } catch (ex) {
      const msg =
        ex instanceof Error && ex.message.includes('already')
          ? 'Ce courriel existe déjà.'
          : 'Impossible de créer le compte.';
      setErr(msg);
    }
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="card">
      <h1 style={{ marginTop: 0 }}>Créer un compte</h1>
      <form onSubmit={(e) => void submit(e)}>
        <label htmlFor="dn">Pseudonyme</label>
        <input
          id="dn"
          value={displayName}
          minLength={1}
          maxLength={120}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <label htmlFor="email">Courriel</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <label htmlFor="pass">Mot de passe (au moins 8 caractères)</label>
        <input
          id="pass"
          type="password"
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <div className="actions">
          <button type="submit" className="primary">
            Créer
          </button>
        </div>
        {err ? <p className="error-msg">{err}</p> : null}
        <p style={{ opacity: 0.8, marginTop: '1rem' }}>
          Retour ? <Link to="/login">connexion</Link>
        </p>
      </form>
    </div>
  );
}
