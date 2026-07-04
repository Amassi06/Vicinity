import { FormEvent, useEffect, useState, type ReactElement } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useT } from '../i18n/I18nContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';

type PublicNeighbourhood = { id: string; name: string };

export function RegisterPage(): ReactElement {
  const nav = useNavigate();
  const { user, register } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [neighbourhoods, setNeighbourhoods] = useState<PublicNeighbourhood[]>([]);
  const [neighbourhoodId, setNeighbourhoodId] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/neighbourhoods/public');
        if (res.ok) setNeighbourhoods((await res.json()) as PublicNeighbourhood[]);
      } catch {
        /* la liste reste vide, le select affichera l'état vide */
      }
    })();
  }, []);

  async function submit(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    if (!neighbourhoodId) {
      setErr(t('register.errorNeighbourhood'));
      return;
    }
    try {
      await register(email.trim(), password, displayName.trim(), neighbourhoodId);
      nav('/');
    } catch (ex) {
      const msg =
        ex instanceof Error && ex.message.includes('already')
          ? t('register.errorExists')
          : t('register.errorGeneric');
      setErr(msg);
    }
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">{t('register.title')}</CardTitle>
        <CardDescription>{t('register.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="dn">{t('register.displayName')}</Label>
            <Input
              id="dn"
              value={displayName}
              minLength={1}
              maxLength={120}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('register.email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('register.neighbourhood')}</Label>
            <Select value={neighbourhoodId} onValueChange={setNeighbourhoodId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('register.neighbourhoodPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {neighbourhoods.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pass">{t('register.password')}</Label>
            <Input
              id="pass"
              type="password"
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            {t('register.submit')}
          </Button>
          {err ? (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-center text-sm text-muted-foreground">
            {t('register.backToLogin')}{' '}
            <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              {t('register.login')}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
