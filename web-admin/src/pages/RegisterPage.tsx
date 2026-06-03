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
    try {
      await register(email.trim(), password, displayName.trim());
      nav('/');
    } catch {
      setErr('Inscription impossible.');
    }
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="card">
      <h1>Inscription</h1>
      <form onSubmit={(e) => void submit(e)}>
        <label htmlFor="dn">Pseudonyme</label>
        <input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <label htmlFor="email">Courriel</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="pass">Mot de passe (au moins 8 caractères)</label>
        <input
          id="pass"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="primary">
          Créer
        </button>
        {err ? <p className="error-msg">{err}</p> : null}
        <p>
          <Link to="/login">Connexion</Link>
        </p>
      </form>
    </div>
  );
}
