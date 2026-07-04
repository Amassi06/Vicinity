import { FormEvent, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

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
    return (
      <Alert variant="destructive" className="m-6">
        <AlertDescription>Réservé aux modérateurs et administrateurs.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="m-6">
      <CardHeader>
        <CardTitle className="text-xl">Compilateur DSL</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-3" onSubmit={(e) => void compile(e)}>
          <Textarea
            rows={8}
            value={dsl}
            onChange={(e) => setDsl(e.target.value)}
            className="font-mono text-sm"
          />
          <Button type="submit">Compiler</Button>
        </form>
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
        {result ? (
          <pre className="overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">
            {result}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
