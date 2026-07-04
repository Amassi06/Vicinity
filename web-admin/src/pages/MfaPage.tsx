import { FormEvent, useState, type ReactElement } from 'react';
import QRCode from 'qrcode';
import { apiFetch } from '../lib/api.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

export function MfaPage(): ReactElement {
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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
      setQrDataUrl(await QRCode.toDataURL(res.otpauthUri, { width: 220, margin: 1 }));
      setMsg('Secret généré — activez avec un code TOTP.');
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
      setQrDataUrl(null);
      setMsg('MFA désactivé.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <Card className="mx-auto mt-6 max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">MFA administrateur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" onClick={() => void enroll()}>
          Enrôler TOTP
        </Button>
        {secret ? (
          <div className="space-y-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code TOTP"
                className="rounded-md border border-border bg-white p-2"
                width={220}
                height={220}
              />
            ) : null}
            <pre className="overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">
              {secret}
              {'\n'}
              {otpauthUri}
            </pre>
          </div>
        ) : null}
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void activate(e)}>
          <Input className="max-w-40" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Code TOTP" />
          <Button type="submit" variant="secondary">
            Activer
          </Button>
          <Button type="button" variant="secondary" onClick={(e) => void disable(e)}>
            Désactiver
          </Button>
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
