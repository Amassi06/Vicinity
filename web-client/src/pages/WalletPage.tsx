import { useEffect, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useT } from '../i18n/I18nContext.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';

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
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const w = await apiFetch<Wallet>('/me/wallet');
        setWallet(w);
      } catch (e) {
        setErr(e instanceof Error ? e.message : t('common.error.generic'));
      }
    })();
  }, [t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('wallet.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
        {wallet ? (
          <>
            <p className="text-xl">
              {t('wallet.balance')} <strong>{wallet.balance}</strong> {t('wallet.points')}
            </p>
            <h3 className="mt-4 text-sm font-semibold">{t('wallet.history.title')}</h3>
            {!wallet.recent || wallet.recent.length === 0 ? (
              <p className="text-muted-foreground">{t('wallet.history.empty')}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {wallet.recent.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 p-3"
                  >
                    <Badge variant={tx.direction === 'CREDIT' ? 'success' : 'secondary'}>
                      {tx.direction === 'CREDIT' ? t('wallet.history.received') : t('wallet.history.sent')}
                    </Badge>
                    <strong>
                      {tx.direction === 'CREDIT' ? '+' : '-'}
                      {tx.amount} {t('wallet.points')}
                    </strong>
                    <span className="text-sm text-muted-foreground">
                      {t(`wallet.reason.${tx.reason}`)}
                    </span>
                    {tx.contractId ? (
                      <span className="text-xs text-muted-foreground">
                        {t('wallet.contractRef')} {tx.contractId.slice(-6)}
                      </span>
                    ) : null}
                    <span className="text-sm text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">{t('common.loading')}</p>
        )}
      </CardContent>
    </Card>
  );
}
