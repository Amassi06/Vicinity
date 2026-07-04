import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useAuth } from '../context/AuthContext.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { useT } from '../i18n/I18nContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';
import { Badge } from '@/components/ui/badge.js';

type IncidentDoc = {
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
  const [items, setItems] = useState<IncidentDoc[]>([]);
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ items: IncidentCategory[] }>('/incident-categories')
      .then((r) => {
        setCategories(r.items);
        if (r.items.length > 0) setCategory((prev) => prev || r.items[0]!.slug);
      })
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) {
      setItems([]);
      return;
    }
    try {
      const res = await apiFetch<{ items: IncidentDoc[] }>(`/incidents?neighbourhoodId=${selectedId}`);
      setItems(res.items);
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }, [selectedId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryLabel = (slug: string): string =>
    categories.find((c) => c.slug === slug)?.label ?? slug;

  async function create(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!selectedId) return;
    setErr(null);
    try {
      await apiFetch('/incidents', {
        method: 'POST',
        json: { neighbourhoodId: selectedId, title, description, category },
      });
      setTitle('');
      setDescription('');
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }

  async function setStatus(id: string, status: IncidentDoc['status']): Promise<void> {
    setErr(null);
    try {
      await apiFetch(`/incidents/${id}`, { method: 'PATCH', json: { status } });
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('incidents.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedId ? (
          <p className="text-muted-foreground">{t('common.selectNeighbourhood')}</p>
        ) : (
          <>
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void create(e)}>
              <Input
                className="max-w-56"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('incidents.form.title')}
                required
              />
              <Input
                className="max-w-56"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('incidents.form.description')}
              />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('incidents.form.categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={categories.length === 0}>
                {t('incidents.form.report')}
              </Button>
            </form>
            {err ? (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ) : null}
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-input p-8 text-center text-muted-foreground">
                {t('incidents.empty')}
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((i) => (
                  <li
                    key={i._id}
                    className="rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{i.title}</strong>
                      <Badge variant="secondary">{categoryLabel(i.category)}</Badge>
                      <Badge variant={STATUS_BADGE_VARIANT[i.status]}>{t(`incidents.status.${i.status}`)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>
                    {user?.role === 'ADMIN' ? (
                      <Select
                        value={i.status}
                        onValueChange={(v) => void setStatus(i._id, v as IncidentDoc['status'])}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
