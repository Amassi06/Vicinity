import { useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';

type Wallet = { balance: number; recent?: unknown[] };

export function WalletPage(): ReactElement {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const w = await apiFetch<Wallet>('/me/wallet');
        setWallet(w);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erreur');
      }
    })();
  }, []);

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Portefeuille</h1>
      {err ? <p className="error-msg">{err}</p> : null}
      {wallet ? (
        <p className="wallet-balance">
          Solde : <strong>{wallet.balance}</strong> points
        </p>
      ) : (
        <p className="muted">Chargement…</p>
      )}
    </section>
  );
}
