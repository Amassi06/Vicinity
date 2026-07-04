import { useEffect, useState, type ReactElement, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useT } from '../i18n/I18nContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';

type NeighbourhoodOption = { id: string; name: string };

export function AccountPage(): ReactElement {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [mfaToken, setMfaToken] = useState('');
  const [neighbourhoods, setNeighbourhoods] = useState<NeighbourhoodOption[]>([]);
  const [neighbourhoodId, setNeighbourhoodId] = useState(user?.neighbourhoodId ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<NeighbourhoodOption[]>('/neighbourhoods')
      .then((rows) => setNeighbourhoods(rows.map(({ id, name }) => ({ id, name }))))
      .catch(() => setNeighbourhoods([]));
  }, []);

  async function saveName(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/me/profile', { method: 'PATCH', json: { displayName } });
      await refreshUser();
      setMsg(t('account.saved'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    }
  }

  async function saveEmail(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const payload: { email: string; mfaToken?: string } = { email };
      if (mfaToken.trim()) payload.mfaToken = mfaToken.trim();
      await apiFetch('/me/profile', { method: 'PATCH', json: payload });
      await refreshUser();
      setMsg(t('account.saved'));
      setMfaToken('');
    } catch (e) {
      const m = e instanceof Error ? e.message : t('common.error.generic');
      setErr(m === 'mfa_required' ? t('account.errorMfaRequired') : m);
    }
  }

  async function saveNeighbourhood(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    setErr(null);
    setMsg(null);
    if (!neighbourhoodId) return;
    try {
      await apiFetch('/me/profile', { method: 'PATCH', json: { neighbourhoodId } });
      await refreshUser();
      setMsg(t('account.saved'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    }
  }

  async function deleteAccount(): Promise<void> {
    if (!window.confirm(t('account.deleteConfirm'))) return;
    try {
      await apiFetch('/me/delete-account', { method: 'POST' });
      await logout();
      navigate('/login');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.error.generic'));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('account.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('account.profile')}</h2>
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void saveName(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="dn">{t('account.displayName')}</Label>
              <Input
                id="dn"
                className="max-w-56"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="secondary" className="self-end">
              {t('account.save')}
            </Button>
          </form>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void saveEmail(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('account.email')}</Label>
              <Input
                id="email"
                type="email"
                className="max-w-56"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mfa">{t('account.mfaToken')}</Label>
              <Input
                id="mfa"
                className="max-w-32"
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value)}
                maxLength={6}
              />
            </div>
            <Button type="submit" variant="secondary">
              {t('account.save')}
            </Button>
          </form>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('account.neighbourhood')}</h2>
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void saveNeighbourhood(e)}>
            <Select value={neighbourhoodId} onValueChange={setNeighbourhoodId}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder={t('account.neighbourhoodPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {neighbourhoods.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="secondary">
              {t('account.save')}
            </Button>
          </form>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('account.dangerZone')}</h2>
          <Button type="button" variant="destructive" onClick={() => void deleteAccount()}>
            {t('account.delete')}
          </Button>
        </div>

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
