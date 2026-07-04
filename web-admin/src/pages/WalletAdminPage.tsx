import { FormEvent, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

export function WalletAdminPage(): ReactElement {
  const { user } = useAuth();
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('100');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (user?.role !== 'ADMIN') {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertDescription>Réservé aux administrateurs.</AlertDescription>
      </Alert>
    );
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
    <Card className="m-6">
      <CardHeader>
        <CardTitle className="text-xl">Crédit portefeuille</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void submit(e)}>
          <Input
            className="max-w-72"
            placeholder="UUID utilisateur"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            required
          />
          <Input
            type="number"
            className="max-w-32"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Button type="submit">Créditer</Button>
        </form>
        {msg ? <p>{msg}</p> : null}
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
