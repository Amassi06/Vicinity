import { FormEvent, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

export function DslPage(): ReactElement {
  const { user } = useAuth();
  const [dsl, setDsl] = useState('status = published');
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allowed = user?.role === 'ADMIN' || user?.role === 'MODERATOR';

  async function compile(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    setResult(null);
    try {
      const res = await apiFetch<{ compiled: unknown }>('/dsl/compile', {
        method: 'POST',
        json: { dsl },
      });
      setResult(JSON.stringify(res.compiled, null, 2));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur compilation');
    }
  }

  if (!allowed) {
    return <p className="admin-warn">Réservé aux modérateurs et administrateurs.</p>;
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Compilateur DSL</h1>
      <form onSubmit={(e) => void compile(e)}>
        <textarea rows={8} value={dsl} onChange={(e) => setDsl(e.target.value)} className="code-area" />
        <button type="submit" className="primary">
          Compiler
        </button>
      </form>
      {err ? <p className="error-msg">{err}</p> : null}
      {result ? <pre className="code-out">{result}</pre> : null}
    </section>
  );
}
