import { useEffect, useState, type ReactElement } from 'react';
import { ArrowDownLeft, ArrowUpRight, ReceiptText, Wallet as WalletIcon } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useT } from '../i18n/I18nContext.js';
import { PageHeader } from '../components/PageHeader.js';
import { EmptyState } from '../components/EmptyState.js';
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { cn } from '@/lib/utils.js';

type WalletTransaction = {
  id: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  reason: string;
  listingId: string | null;
  contractId: string | null;
  counterpartyId: string | null;
  createdAt: string;
};

type Wallet = { balance: number; recent?: WalletTransaction[] };

export function WalletPage(): ReactElement {
  const t = useT();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    apiFetch<Wallet>('/me/wallet')
      .then((response) => {
        if (mounted) setWallet(response);
      })
      .catch((error) => {
        if (mounted) setErrorMessage(apiErrorMessage(error, t));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  const transactions = wallet?.recent ?? [];

  return (
    <div>
      <PageHeader title={t('wallet.title')} description={t('wallet.subtitle')} />

      {errorMessage ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* Solde en héros : l'information principale de la page, en un coup d'œil. */}
      <section className="card-sheen mb-8 flex items-center gap-4 rounded-xl border border-border/70 bg-card/70 p-6 backdrop-blur-md">
        <span className="brand-mark flex size-12 shrink-0 items-center justify-center rounded-xl text-white">
          <WalletIcon className="size-6" />
        </span>
        <div>
          <p className="text-sm text-muted-foreground">{t('wallet.balance')}</p>
          {loading ? (
            <Skeleton className="mt-1 h-9 w-28" />
          ) : (
            <p className="text-3xl font-semibold tabular-nums">
              {wallet?.balance ?? '—'}{' '}
              <span className="text-base font-normal text-muted-foreground">
                {t('wallet.points')}
              </span>
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('wallet.history.title')}</h2>
        {loading ? (
          <ListSkeleton />
        ) : transactions.length === 0 ? (
          <EmptyState icon={ReceiptText} text={t('wallet.history.empty')} />
        ) : (
          <ul className="space-y-2">
            {transactions.map((transaction) => {
              const isCredit = transaction.direction === 'CREDIT';
              return (
                <li
                  key={transaction.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      isCredit
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {isCredit ? (
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t(`wallet.reason.${transaction.reason}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.createdAt).toLocaleString()}
                      {transaction.contractId
                        ? ` · ${t('wallet.contractRef')} ${transaction.contractId.slice(-6)}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      isCredit ? 'text-emerald-400' : 'text-foreground',
                    )}
                  >
                    {isCredit ? '+' : '−'}
                    {transaction.amount} {t('wallet.points')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
