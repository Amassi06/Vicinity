import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Plus, TriangleAlert } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useAuth } from '../context/AuthContext.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { useToast } from '../context/ToastContext.js';
import { useT } from '../i18n/I18nContext.js';
import { PageHeader } from '../components/PageHeader.js';
import { EmptyState } from '../components/EmptyState.js';
import { Modal } from '../components/Modal.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';
import { Badge } from '@/components/ui/badge.js';
import { ListSkeleton } from '@/components/ui/skeleton.js';

type Incident = {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved';
};

type IncidentCategory = { id: string; slug: string; label: string };

const STATUS_BADGE_VARIANT = {
  open: 'destructive',
  in_progress: 'warning',
  resolved: 'success',
} as const;

export function IncidentsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const { user } = useAuth();
  const t = useT();
  const { showToast } = useToast();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Champs de la modale de signalement
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    void apiFetch<{ items: IncidentCategory[] }>('/incident-categories')
      .then((response) => {
        setCategories(response.items);
        if (response.items.length > 0) setCategory((previous) => previous || response.items[0]!.slug);
      })
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) {
      setIncidents([]);
      setLoading(false);
      return;
    }
    try {
      const response = await apiFetch<{ items: Incident[] }>(
        `/incidents?neighbourhoodId=${selectedId}`,
      );
      setIncidents(response.items);
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  }, [selectedId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryLabel = (slug: string): string =>
    categories.find((incidentCategory) => incidentCategory.slug === slug)?.label ?? slug;

  async function create(formEvent: FormEvent): Promise<void> {
    formEvent.preventDefault();
    if (!selectedId) return;
    setErrorMessage(null);
    try {
      await apiFetch('/incidents', {
        method: 'POST',
        json: { neighbourhoodId: selectedId, title, description, category },
      });
      setTitle('');
      setDescription('');
      setCreating(false);
      showToast(t('incidents.reported'));
      await load();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  async function setStatus(incidentId: string, status: Incident['status']): Promise<void> {
    setErrorMessage(null);
    try {
      await apiFetch(`/incidents/${incidentId}`, { method: 'PATCH', json: { status } });
      await load();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  return (
    <div>
      <PageHeader
        title={t('incidents.title')}
        description={t('incidents.subtitle')}
        action={
          selectedId ? (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('incidents.new')}
            </Button>
          ) : undefined
        }
      />

      {!selectedId ? (
        <p className="text-muted-foreground">{t('common.selectNeighbourhood')}</p>
      ) : (
        <div className="space-y-4">
          {errorMessage && !creating ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <ListSkeleton />
          ) : incidents.length === 0 ? (
            <EmptyState icon={TriangleAlert} text={t('incidents.empty')} />
          ) : (
            <ul className="space-y-2">
              {incidents.map((incident) => (
                <li
                  key={incident._id}
                  className="rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{incident.title}</strong>
                    <Badge variant="secondary">{categoryLabel(incident.category)}</Badge>
                    <Badge variant={STATUS_BADGE_VARIANT[incident.status]}>
                      {t(`incidents.status.${incident.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{incident.description}</p>
                  {user?.role === 'ADMIN' ? (
                    <Select
                      value={incident.status}
                      onValueChange={(value) =>
                        void setStatus(incident._id, value as Incident['status'])
                      }
                    >
                      <SelectTrigger className="mt-2.5 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">{t('incidents.status.open')}</SelectItem>
                        <SelectItem value="in_progress">{t('incidents.status.in_progress')}</SelectItem>
                        <SelectItem value="resolved">{t('incidents.status.resolved')}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {creating ? (
        <Modal title={t('incidents.new')} onClose={() => setCreating(false)}>
          <form className="space-y-3" onSubmit={(formEvent) => void create(formEvent)}>
            <div className="space-y-1.5">
              <Label htmlFor="incident-title">{t('incidents.form.title')}</Label>
              <Input
                id="incident-title"
                value={title}
                onChange={(changeEvent) => setTitle(changeEvent.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="incident-description">{t('incidents.form.description')}</Label>
              <Input
                id="incident-description"
                value={description}
                onChange={(changeEvent) => setDescription(changeEvent.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('incidents.form.category')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('incidents.form.categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((incidentCategory) => (
                    <SelectItem key={incidentCategory.slug} value={incidentCategory.slug}>
                      {incidentCategory.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={categories.length === 0}>
                {t('incidents.form.report')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
