import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useT } from '../i18n/I18nContext.js';
import { PageHeader } from '../components/PageHeader.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { ListSkeleton } from '@/components/ui/skeleton.js';

type Consents = {
  marketing: boolean;
  analytics: boolean;
  neighbourhood_digest: boolean;
};

export function PrivacyPage(): ReactElement {
  const t = useT();
  const [consents, setConsents] = useState<Consents | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ consents: Consents }>('/me/consents')
      .then((response) => setConsents(response.consents))
      .catch((error) => setErrorMessage(apiErrorMessage(error, t)));
  }, [t]);

  async function saveConsents(nextConsents: Consents): Promise<void> {
    try {
      const response = await apiFetch<{ consents: Consents }>('/me/consents', {
        method: 'PATCH',
        json: nextConsents,
      });
      setConsents(response.consents);
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  async function exportData(): Promise<void> {
    try {
      const data = await apiFetch<Record<string, unknown>>('/me/export');
      setExportJson(JSON.stringify(data, null, 2));
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  return (
    <div>
      <PageHeader title={t('privacy.title')} description={t('privacy.subtitle')} />

      {errorMessage ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {!consents ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('privacy.rights.title')}</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('privacy.consents')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(consents) as (keyof Consents)[]).map((consentKey) => (
                <label key={consentKey} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={consents[consentKey]}
                    onChange={(changeEvent) =>
                      void saveConsents({ ...consents, [consentKey]: changeEvent.target.checked })
                    }
                  />
                  {t(`privacy.consent.${consentKey}`)}
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('privacy.portability.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button type="button" variant="secondary" onClick={() => void exportData()}>
                {t('privacy.export')}
              </Button>
              {exportJson ? (
                <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">
                  {exportJson}
                </pre>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
