import { FormEvent, useState, type ReactElement } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

export function LoginPage(): ReactElement {
  const nav = useNavigate();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    try {
      await login(email.trim(), password, needsMfa ? mfaToken.trim() : undefined);
      nav('/');
    } catch (e) {
      if (e instanceof Error && e.message === 'mfa_required') {
        setNeedsMfa(true);
        setErr('Code MFA requis.');
        return;
      }
      if (e instanceof Error && e.message === 'forbidden_role') {
        setErr('Cet espace est réservé aux administrateurs et modérateurs.');
        return;
      }
      setErr('Identifiants invalides.');
    }
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Connexion admin</CardTitle>
        <CardDescription>Back-office réservé aux administrateurs et modérateurs.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Courriel</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pass">Mot de passe</Label>
            <Input
              id="pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {needsMfa ? (
            <div className="space-y-1.5">
              <Label htmlFor="mfa">Code MFA</Label>
              <Input
                id="mfa"
                inputMode="numeric"
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value)}
                required
                autoFocus
              />
            </div>
          ) : null}
          <Button type="submit" className="w-full">
            Continuer
          </Button>
          {err ? (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
