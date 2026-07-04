import { FormEvent, useCallback, useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useAuth } from '../context/AuthContext.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { useT } from '../i18n/I18nContext.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';
import { Badge } from '@/components/ui/badge.js';

type ListingDoc = {
  _id: string;
  authorId: string;
  title: string;
  description?: string;
  kind: string;
  category: string;
  location?: string;
  serviceDate?: string | null;
  pricePoints: number;
  status: string;
  contractId?: string | null;
};

type ContractDoc = {
  _id: string;
  status: string;
  pricePoints: number;
  payerId: string;
  payeeId: string;
  payerSignedAt?: string | null;
  payeeSignedAt?: string | null;
};

type CategoryDoc = { id: string; slug: string; label: string };

export function ListingsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const { user } = useAuth();
  const t = useT();
  const [items, setItems] = useState<ListingDoc[]>([]);
  const [contracts, setContracts] = useState<Record<string, ContractDoc>>({});
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Champs de la modale de création
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'offer' | 'request'>('offer');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [pricePoints, setPricePoints] = useState(0);

  const load = useCallback(async () => {
    if (!selectedId || !user) {
      setItems([]);
      return;
    }
    try {
      const res = await apiFetch<{ items: ListingDoc[] }>(
        `/listings?neighbourhoodId=${selectedId}`,
      );
      setItems(res.items);
      // Contrats des annonces où je suis impliqué (payer/payee) : nécessaires
      // pour afficher l'état des signatures et les bons boutons.
      const withContract = res.items.filter((l) => l.contractId);
      const fetched: Record<string, ContractDoc> = {};
      await Promise.all(
        withContract.map(async (l) => {
          try {
            const c = await apiFetch<ContractDoc>(`/contracts/${String(l.contractId)}`);
            fetched[String(l.contractId)] = c;
          } catch {
            /* 403 pour les contrats des autres : normal, on n'affiche rien */
          }
        }),
      );
      setContracts(fetched);
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }, [selectedId, user, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiFetch<{ items: CategoryDoc[] }>('/listing-categories')
      .then((r) => {
        setCategories(r.items);
        if (r.items.length > 0) setCategory((prev) => prev || r.items[0]!.slug);
      })
      .catch(() => setCategories([]));
  }, []);

  async function create(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!selectedId) return;
    setErr(null);
    try {
      await apiFetch('/listings', {
        method: 'POST',
        json: {
          neighbourhoodId: selectedId,
          title,
          description,
          kind,
          category,
          location,
          ...(serviceDate ? { serviceDate } : {}),
          pricePoints,
        },
      });
      setTitle('');
      setDescription('');
      setLocation('');
      setServiceDate('');
      setPricePoints(0);
      setModalOpen(false);
      setMsg(t('listings.created'));
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }

  async function run(action: () => Promise<unknown>, successMsg?: string): Promise<void> {
    setErr(null);
    setMsg(null);
    try {
      await action();
      if (successMsg) setMsg(successMsg);
      await load();
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }

  const accept = (id: string): Promise<void> =>
    run(() => apiFetch(`/listings/${id}/accept`, { method: 'POST' }), t('listings.accepted'));
  const cancelListing = (id: string): Promise<void> =>
    run(() => apiFetch(`/listings/${id}/cancel`, { method: 'POST' }));
  const sign = (contractId: string): Promise<void> =>
    run(() => apiFetch(`/contracts/${contractId}/sign`, { method: 'POST' }), t('listings.signed'));
  const complete = (contractId: string): Promise<void> =>
    run(
      () => apiFetch(`/contracts/${contractId}/complete`, { method: 'POST' }),
      t('listings.contractCompleted'),
    );
  const cancelContract = (contractId: string): Promise<void> =>
    run(
      () => apiFetch(`/contracts/${contractId}/cancel`, { method: 'POST' }),
      t('listings.contractCancelled'),
    );

  const categoryLabel = (slug: string): string =>
    categories.find((c) => c.slug === slug)?.label ?? slug;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('listings.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedId ? (
          <p className="text-muted-foreground">{t('common.selectNeighbourhood')}</p>
        ) : (
          <>
            <Button type="button" onClick={() => setModalOpen(true)}>
              {t('listings.new')}
            </Button>
            {msg ? <p>{msg}</p> : null}
            {err && !modalOpen ? (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ) : null}
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-input p-8 text-center text-muted-foreground">
                {t('listings.empty')}
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((l) => (
                  <ListingItem
                    key={l._id}
                    listing={l}
                    contract={l.contractId ? contracts[l.contractId] : undefined}
                    userId={user?.sub}
                    t={t}
                    categoryLabel={categoryLabel(l.category)}
                    onAccept={() => void accept(l._id)}
                    onCancelListing={() => void cancelListing(l._id)}
                    onSign={(cid) => void sign(cid)}
                    onComplete={(cid) => void complete(cid)}
                    onCancelContract={(cid) => void cancelContract(cid)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold">{t('listings.modal.title')}</h2>
            <form className="space-y-3" onSubmit={(e) => void create(e)}>
              <div className="space-y-1.5">
                <Label htmlFor="l-title">{t('listings.form.title')}</Label>
                <Input
                  id="l-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  minLength={3}
                  required
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1.5">
                  <Label>{t('listings.form.kind')}</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as 'offer' | 'request')}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offer">{t('listings.form.offer')}</SelectItem>
                      <SelectItem value="request">{t('listings.form.request')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('listings.form.category')}</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={t('listings.form.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="l-location">{t('listings.form.location')}</Label>
                  <Input
                    id="l-location"
                    className="w-56"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l-date">{t('listings.form.date')}</Label>
                  <Input
                    id="l-date"
                    type="datetime-local"
                    className="w-56"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-desc">{t('listings.form.description')}</Label>
                <Textarea
                  id="l-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-price">{t('listings.form.pricePoints')}</Label>
                <Input
                  id="l-price"
                  type="number"
                  className="w-40"
                  min={0}
                  step={1}
                  value={pricePoints}
                  onChange={(e) => setPricePoints(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              {err ? (
                <Alert variant="destructive">
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  {t('listings.modal.cancel')}
                </Button>
                <Button type="submit" disabled={categories.length === 0}>
                  {t('listings.form.create')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function ListingItem({
  listing,
  contract,
  userId,
  t,
  categoryLabel,
  onAccept,
  onCancelListing,
  onSign,
  onComplete,
  onCancelContract,
}: {
  listing: ListingDoc;
  contract: ContractDoc | undefined;
  userId: string | undefined;
  t: (key: string) => string;
  categoryLabel: string;
  onAccept: () => void;
  onCancelListing: () => void;
  onSign: (contractId: string) => void;
  onComplete: (contractId: string) => void;
  onCancelContract: (contractId: string) => void;
}): ReactElement {
  const isAuthor = userId === listing.authorId;
  const isParticipant =
    !!contract && !!userId && [contract.payerId, contract.payeeId].includes(userId);
  const iSigned =
    contract && userId
      ? (contract.payerId === userId && !!contract.payerSignedAt) ||
        (contract.payeeId === userId && !!contract.payeeSignedAt)
      : false;

  return (
    <li className="rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">{listing.title}</strong>
        <Badge variant="secondary">
          {listing.kind === 'offer' ? t('listings.form.offer') : t('listings.form.request')}
        </Badge>
        <Badge variant="outline">{categoryLabel}</Badge>
        <Badge variant={listing.status === 'open' ? 'success' : 'secondary'}>
          {t(`listings.status.${listing.status}`)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {listing.pricePoints > 0
            ? `${listing.pricePoints} ${t('wallet.points')}`
            : t('listings.free')}
        </span>
      </div>
      {listing.description || listing.location || listing.serviceDate ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {listing.description}
          {listing.location ? ` — ${listing.location}` : ''}
          {listing.serviceDate ? ` — ${new Date(listing.serviceDate).toLocaleString()}` : ''}
        </p>
      ) : null}

      {listing.status === 'open' ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {!isAuthor ? (
            <Button size="sm" variant="secondary" onClick={onAccept}>
              {t('listings.accept')}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onCancelListing}>
              {t('listings.cancel')}
            </Button>
          )}
        </div>
      ) : null}

      {contract && isParticipant ? (
        <div className="mt-2.5 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={contract.status === 'escrowed' ? 'warning' : 'secondary'}>
              {t(`listings.contract.${contract.status}`)}
            </Badge>
            {contract.status === 'pending_signatures' ? (
              <span>
                {contract.payerSignedAt ? '✓' : '…'} {t('listings.payerSignature')} ·{' '}
                {contract.payeeSignedAt ? '✓' : '…'} {t('listings.payeeSignature')}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {contract.status === 'pending_signatures' && !iSigned ? (
              <Button size="sm" onClick={() => onSign(contract._id)}>
                {t('listings.sign')}
              </Button>
            ) : null}
            {contract.status === 'escrowed' ? (
              <Button size="sm" onClick={() => onComplete(contract._id)}>
                {t('listings.complete')}
              </Button>
            ) : null}
            {['pending_signatures', 'escrowed'].includes(contract.status) ? (
              <Button size="sm" variant="secondary" onClick={() => onCancelContract(contract._id)}>
                {t('listings.cancelContract')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
