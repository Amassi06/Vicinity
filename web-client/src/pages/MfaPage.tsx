import { FormEvent, useState, type ReactElement } from 'react';
import QRCode from 'qrcode';
import { apiFetch } from '../lib/api.js';
import { useT } from '../i18n/I18nContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

export function MfaPage(): ReactElement {
  const t = useT();
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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
      setQrDataUrl(await QRCode.toDataURL(res.otpauthUri, { width: 220, margin: 1 }));
      setMsg(t('mfa.instructions'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    }
  }

  async function activate(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    try {
      await apiFetch('/auth/mfa/activate', { method: 'POST', json: { token } });
      setMsg(t('mfa.activated'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    }
  }

  async function disable(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    try {
      await apiFetch('/auth/mfa/disable', { method: 'POST', json: { token } });
      setSecret(null);
      setOtpauthUri(null);
      setQrDataUrl(null);
      setMsg(t('mfa.disabled'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('mfa.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" onClick={() => void enroll()}>
          {t('mfa.generate')}
        </Button>
        {secret ? (
          <div className="space-y-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={t('mfa.qrAlt')}
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
          <Input
            className="max-w-40"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('mfa.tokenPlaceholder')}
            maxLength={8}
          />
          <Button type="submit" variant="secondary">
            {t('mfa.activate')}
          </Button>
          <Button type="button" variant="secondary" onClick={(e) => void disable(e)}>
            {t('mfa.disable')}
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
