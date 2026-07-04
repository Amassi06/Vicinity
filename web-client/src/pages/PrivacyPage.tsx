import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { useT } from '../i18n/I18nContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

type Consents = {
  marketing: boolean;
  analytics: boolean;
  neighbourhood_digest: boolean;
};

export function PrivacyPage(): ReactElement {
  const t = useT();
  const [consents, setConsents] = useState<Consents | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ consents: Consents }>('/me/consents')
      .then((r) => setConsents(r.consents))
      .catch((e) => setErr(e instanceof Error ? e.message : t('common.error.generic')));
  }, [t]);

  async function saveConsents(next: Consents): Promise<void> {
    try {
      const res = await apiFetch<{ consents: Consents }>('/me/consents', {
        method: 'PATCH',
        json: next,
      });
      setConsents(res.consents);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    }
  }

  async function exportData(): Promise<void> {
    try {
      const data = await apiFetch<Record<string, unknown>>('/me/export');
      setExportJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    }
  }

  if (!consents) return <p className="text-muted-foreground">{t('privacy.loading')}</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('privacy.title')}</CardTitle>
        <CardDescription>{t('privacy.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t('privacy.rights.title')}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t('privacy.rights.access')}</li>
            <li>
              {t('privacy.rights.rectification')}{' '}
              <Link to="/compte" className="font-medium text-primary underline-offset-4 hover:underline">
                {t('privacy.rights.accountLink')}
              </Link>
            </li>
            <li>{t('privacy.rights.erasure')}</li>
            <li>{t('privacy.rights.portability')}</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t('privacy.consents')}</h2>
          {(Object.keys(consents) as (keyof Consents)[]).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={consents[key]}
                onChange={(e) => void saveConsents({ ...consents, [key]: e.target.checked })}
              />
              {t(`privacy.consent.${key}`)}
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t('privacy.portability.title')}</h2>
          <Button type="button" onClick={() => void exportData()}>
            {t('privacy.export')}
          </Button>
          {exportJson ? (
            <pre className="overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">
              {exportJson}
            </pre>
          ) : null}
        </div>

        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
