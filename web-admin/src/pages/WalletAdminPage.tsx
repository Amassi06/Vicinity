import { FormEvent, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

export function WalletAdminPage(): ReactElement {
  const { user } = useAuth();
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('100');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (user?.role !== 'ADMIN') {
    return <p className="admin-warn">Réservé aux administrateurs.</p>;
  }

  async function submit(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/admin/wallet/credit', {
        method: 'POST',
        json: {
          toUserId: toUserId.trim(),
          amount: Number(amount),
          reason: 'ADMIN_ADJUSTMENT',
        },
      });
      setMsg('Points crédités.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Crédit portefeuille</h1>
      <form className="inline-form" onSubmit={(e) => void submit(e)}>
        <input
          placeholder="UUID utilisateur"
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
          required
        />
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <button type="submit" className="primary">
          Créditer
        </button>
      </form>
      {msg ? <p>{msg}</p> : null}
      {err ? <p className="error-msg">{err}</p> : null}
    </section>
  );
}
