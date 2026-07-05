import { useEffect, useState, type ReactElement, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { useT } from '../i18n/I18nContext.js';
import { PageHeader } from '../components/PageHeader.js';
import { Modal } from '../components/Modal.js';
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
  const { showToast } = useToast();
  const t = useT();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [mfaToken, setMfaToken] = useState('');
  const [neighbourhoods, setNeighbourhoods] = useState<NeighbourhoodOption[]>([]);
  const [neighbourhoodId, setNeighbourhoodId] = useState(user?.neighbourhoodId ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<NeighbourhoodOption[]>('/neighbourhoods')
      .then((rows) => setNeighbourhoods(rows.map(({ id, name }) => ({ id, name }))))
      .catch(() => setNeighbourhoods([]));
  }, []);

  /** Enregistre un fragment de profil ; renvoie true en cas de succès. */
  async function saveProfile(formEvent: FormEvent, payload: Record<string, string>): Promise<boolean> {
    formEvent.preventDefault();
    setErrorMessage(null);
    try {
      await apiFetch('/me/profile', { method: 'PATCH', json: payload });
      await refreshUser();
      showToast(t('account.saved'));
      return true;
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
      return false;
    }
  }

  async function saveEmail(formEvent: FormEvent): Promise<void> {
    const payload: Record<string, string> = { email };
    if (mfaToken.trim()) payload['mfaToken'] = mfaToken.trim();
    const saved = await saveProfile(formEvent, payload);
    if (saved) setMfaToken('');
  }

  async function deleteAccount(): Promise<void> {
    try {
      await apiFetch('/me/delete-account', { method: 'POST' });
      await logout();
      navigate('/login');
    } catch (error) {
      setConfirmingDelete(false);
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  return (
    <div>
      <PageHeader title={t('account.title')} />

      {errorMessage ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('account.profile')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(formEvent) => void saveProfile(formEvent, { displayName })}
            >
              <div className="space-y-1.5">
                <Label htmlFor="display-name">{t('account.displayName')}</Label>
                <Input
                  id="display-name"
                  className="max-w-56"
                  value={displayName}
                  onChange={(changeEvent) => setDisplayName(changeEvent.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="secondary">
                {t('account.save')}
              </Button>
            </form>
            <form className="flex flex-wrap items-end gap-2" onSubmit={(formEvent) => void saveEmail(formEvent)}>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t('account.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  className="max-w-56"
                  value={email}
                  onChange={(changeEvent) => setEmail(changeEvent.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mfa-token">{t('account.mfaToken')}</Label>
                <Input
                  id="mfa-token"
                  className="max-w-32"
                  value={mfaToken}
                  onChange={(changeEvent) => setMfaToken(changeEvent.target.value)}
                  maxLength={6}
                />
              </div>
              <Button type="submit" variant="secondary">
                {t('account.save')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('account.neighbourhood')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(formEvent) => {
                formEvent.preventDefault();
                if (neighbourhoodId) void saveProfile(formEvent, { neighbourhoodId });
              }}
            >
              <Select value={neighbourhoodId} onValueChange={setNeighbourhoodId}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder={t('account.neighbourhoodPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {neighbourhoods.map((neighbourhood) => (
                    <SelectItem key={neighbourhood.id} value={neighbourhood.id}>
                      {neighbourhood.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="secondary">
                {t('account.save')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">{t('account.dangerZone')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)}>
              {t('account.delete')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {confirmingDelete ? (
        <Modal title={t('account.delete')} onClose={() => setConfirmingDelete(false)}>
          <p className="text-sm text-muted-foreground">{t('account.deleteConfirm')}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmingDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void deleteAccount()}>
              {t('account.delete')}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
