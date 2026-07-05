import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Plus, ShoppingBag } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';
import { Badge } from '@/components/ui/badge.js';
import { ListSkeleton } from '@/components/ui/skeleton.js';

type Listing = {
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

type Contract = {
  _id: string;
  status: string;
  pricePoints: number;
  payerId: string;
  payeeId: string;
  payerSignedAt?: string | null;
  payeeSignedAt?: string | null;
};

type ListingCategory = { id: string; slug: string; label: string };

export function ListingsPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const { user } = useAuth();
  const t = useT();
  const { showToast } = useToast();

  const [listings, setListings] = useState<Listing[]>([]);
  const [contracts, setContracts] = useState<Record<string, Contract>>({});
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setListings([]);
      setLoading(false);
      return;
    }
    try {
      const response = await apiFetch<{ items: Listing[] }>(
        `/listings?neighbourhoodId=${selectedId}`,
      );
      setListings(response.items);
      // Contrats des annonces où je suis impliqué (payer/payee) : nécessaires
      // pour afficher l'état des signatures et les bons boutons.
      const withContract = response.items.filter((listing) => listing.contractId);
      const fetched: Record<string, Contract> = {};
      await Promise.all(
        withContract.map(async (listing) => {
          try {
            const contract = await apiFetch<Contract>(`/contracts/${String(listing.contractId)}`);
            fetched[String(listing.contractId)] = contract;
          } catch {
            /* 403 pour les contrats des autres : normal, on n'affiche rien */
          }
        }),
      );
      setContracts(fetched);
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  }, [selectedId, user, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiFetch<{ items: ListingCategory[] }>('/listing-categories')
      .then((response) => {
        setCategories(response.items);
        if (response.items.length > 0) setCategory((previous) => previous || response.items[0]!.slug);
      })
      .catch(() => setCategories([]));
  }, []);

  async function create(formEvent: FormEvent): Promise<void> {
    formEvent.preventDefault();
    if (!selectedId) return;
    setErrorMessage(null);
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
      setCreating(false);
      showToast(t('listings.created'));
      await load();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  async function run(action: () => Promise<unknown>, successMessage?: string): Promise<void> {
    setErrorMessage(null);
    try {
      await action();
      if (successMessage) showToast(successMessage);
      await load();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  const acceptListing = (listingId: string): Promise<void> =>
    run(() => apiFetch(`/listings/${listingId}/accept`, { method: 'POST' }), t('listings.accepted'));
  const cancelListing = (listingId: string): Promise<void> =>
    run(() => apiFetch(`/listings/${listingId}/cancel`, { method: 'POST' }));
  const signContract = (contractId: string): Promise<void> =>
    run(() => apiFetch(`/contracts/${contractId}/sign`, { method: 'POST' }), t('listings.signed'));
  const completeContract = (contractId: string): Promise<void> =>
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
    categories.find((listingCategory) => listingCategory.slug === slug)?.label ?? slug;

  return (
    <div>
      <PageHeader
        title={t('listings.title')}
        description={t('listings.subtitle')}
        action={
          selectedId ? (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('listings.new')}
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
          ) : listings.length === 0 ? (
            <EmptyState icon={ShoppingBag} text={t('listings.empty')} />
          ) : (
            <ul className="space-y-2">
              {listings.map((listing) => (
                <ListingItem
                  key={listing._id}
                  listing={listing}
                  contract={listing.contractId ? contracts[listing.contractId] : undefined}
                  userId={user?.sub}
                  categoryLabel={categoryLabel(listing.category)}
                  onAccept={() => void acceptListing(listing._id)}
                  onCancelListing={() => void cancelListing(listing._id)}
                  onSign={(contractId) => void signContract(contractId)}
                  onComplete={(contractId) => void completeContract(contractId)}
                  onCancelContract={(contractId) => void cancelContract(contractId)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {creating ? (
        <Modal title={t('listings.modal.title')} onClose={() => setCreating(false)}>
          <form className="space-y-3" onSubmit={(formEvent) => void create(formEvent)}>
            <div className="space-y-1.5">
              <Label htmlFor="listing-title">{t('listings.form.title')}</Label>
              <Input
                id="listing-title"
                value={title}
                onChange={(changeEvent) => setTitle(changeEvent.target.value)}
                minLength={3}
                required
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1.5">
                <Label>{t('listings.form.kind')}</Label>
                <Select value={kind} onValueChange={(value) => setKind(value === 'request' ? 'request' : 'offer')}>
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
                    {categories.map((listingCategory) => (
                      <SelectItem key={listingCategory.slug} value={listingCategory.slug}>
                        {listingCategory.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="listing-location">{t('listings.form.location')}</Label>
                <Input
                  id="listing-location"
                  className="w-56"
                  value={location}
                  onChange={(changeEvent) => setLocation(changeEvent.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="listing-date">{t('listings.form.date')}</Label>
                <Input
                  id="listing-date"
                  type="datetime-local"
                  className="w-56"
                  value={serviceDate}
                  onChange={(changeEvent) => setServiceDate(changeEvent.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="listing-description">{t('listings.form.description')}</Label>
              <Textarea
                id="listing-description"
                value={description}
                onChange={(changeEvent) => setDescription(changeEvent.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="listing-price">{t('listings.form.pricePoints')}</Label>
              <Input
                id="listing-price"
                type="number"
                className="w-40"
                min={0}
                step={1}
                value={pricePoints}
                onChange={(changeEvent) =>
                  setPricePoints(Math.max(0, Number(changeEvent.target.value) || 0))
                }
              />
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
                {t('listings.form.create')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function ListingItem({
  listing,
  contract,
  userId,
  categoryLabel,
  onAccept,
  onCancelListing,
  onSign,
  onComplete,
  onCancelContract,
}: {
  listing: Listing;
  contract: Contract | undefined;
  userId: string | undefined;
  categoryLabel: string;
  onAccept: () => void;
  onCancelListing: () => void;
  onSign: (contractId: string) => void;
  onComplete: (contractId: string) => void;
  onCancelContract: (contractId: string) => void;
}): ReactElement {
  const t = useT();
  const isAuthor = userId === listing.authorId;
  const isParticipant =
    !!contract && !!userId && [contract.payerId, contract.payeeId].includes(userId);
  const hasSigned =
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
            {contract.status === 'pending_signatures' && !hasSigned ? (
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
