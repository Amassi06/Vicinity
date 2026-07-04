import { FormEvent, useState, type ReactElement } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useT } from '../i18n/I18nContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

export function LoginPage(): ReactElement {
  const nav = useNavigate();
  const { user, login } = useAuth();
  const t = useT();
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
        setErr(t('login.mfaRequired'));
        return;
      }
      if (e instanceof Error && e.message === 'forbidden_role') {
        setErr(t('login.staffAccount'));
        return;
      }
      setErr(t('login.error'));
    }
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">{t('login.title')}</CardTitle>
          <CardDescription>{t('login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass">{t('login.password')}</Label>
              <Input
                id="pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {needsMfa ? (
              <div className="space-y-1.5">
                <Label htmlFor="mfa">{t('login.mfaCode')}</Label>
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
              {t('login.continue')}
            </Button>
            {err ? (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ) : null}
            <p className="text-center text-sm text-muted-foreground">
              {t('login.noAccount')}{' '}
              <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
                {t('login.signup')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
