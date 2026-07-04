import { useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

export function SsoPage(): ReactElement {
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function issue(): Promise<void> {
    setErr(null);
    try {
      const res = await apiFetch<{ ssoToken: string }>('/auth/sso/issue', { method: 'POST' });
      setToken(res.ssoToken);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <Card className="mx-auto mt-6 max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">SSO client bureau</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">Émet un jeton court pour le client JavaFX (5 min).</p>
        <Button type="button" onClick={() => void issue()}>
          Émettre un jeton SSO
        </Button>
        {token ? (
          <pre className="select-all overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">
            {token}
          </pre>
        ) : null}
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
