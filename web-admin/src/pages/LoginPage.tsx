import { FormEvent, useState, type ReactElement } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function LoginPage(): ReactElement {
  const nav = useNavigate();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    try {
      await login(email.trim(), password);
      nav('/');
    } catch {
      setErr('Identifiants invalides.');
    }
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="card">
      <h1>Connexion admin</h1>
      <form onSubmit={(e) => void submit(e)}>
        <label htmlFor="email">Courriel</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="pass">Mot de passe</label>
        <input
          id="pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="primary">
          Continuer
        </button>
        {err ? <p className="error-msg">{err}</p> : null}
        <p>
          <Link to="/register">Créer un compte</Link>
        </p>
      </form>
    </div>
  );
}
