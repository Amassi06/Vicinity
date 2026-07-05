import { useState, type ReactElement, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useToast } from '../context/ToastContext.js';
import { useT } from '../i18n/I18nContext.js';
import { PageHeader } from '../components/PageHeader.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

export function MfaPage(): ReactElement {
  const t = useT();
  const { showToast } = useToast();
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function enroll(): Promise<void> {
    setErrorMessage(null);
    try {
      const response = await apiFetch<{ secret: string; otpauthUri: string }>('/auth/mfa/enroll', {
        method: 'POST',
      });
      setSecret(response.secret);
      setOtpauthUri(response.otpauthUri);
      setQrDataUrl(await QRCode.toDataURL(response.otpauthUri, { width: 220, margin: 1 }));
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  async function activate(formEvent: FormEvent): Promise<void> {
    formEvent.preventDefault();
    setErrorMessage(null);
    try {
      await apiFetch('/auth/mfa/activate', { method: 'POST', json: { token } });
      setToken('');
      showToast(t('mfa.activated'));
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  async function disable(): Promise<void> {
    setErrorMessage(null);
    try {
      await apiFetch('/auth/mfa/disable', { method: 'POST', json: { token } });
      setSecret(null);
      setOtpauthUri(null);
      setQrDataUrl(null);
      setToken('');
      showToast(t('mfa.disabled'));
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  return (
    <div>
      <PageHeader title={t('mfa.title')} description={t('mfa.subtitle')} />

      {errorMessage ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-3">
            <Button type="button" onClick={() => void enroll()}>
              {t('mfa.generate')}
            </Button>
            {secret ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('mfa.instructions')}</p>
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
          </div>

          <form className="flex flex-wrap items-end gap-2" onSubmit={(formEvent) => void activate(formEvent)}>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-code">{t('mfa.tokenPlaceholder')}</Label>
              <Input
                id="mfa-code"
                className="max-w-40"
                inputMode="numeric"
                value={token}
                onChange={(changeEvent) => setToken(changeEvent.target.value)}
                maxLength={8}
              />
            </div>
            <Button type="submit" variant="secondary">
              {t('mfa.activate')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void disable()}>
              {t('mfa.disable')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
