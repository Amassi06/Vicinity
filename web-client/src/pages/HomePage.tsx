import type { ReactElement } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useT } from '../i18n/I18nContext.js';
import { Card, CardContent } from '@/components/ui/card.js';

export function HomePage(): ReactElement {
  const { user } = useAuth();
  const t = useT();

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h1 className="mt-0 text-2xl font-semibold tracking-tight">{t('home.title')}</h1>
          <p className="text-muted-foreground">{t('home.subtitle')}</p>
        </div>
        {user?.neighbourhoodName ? (
          <p className="text-muted-foreground">
            {t('home.activeNeighbourhood')}{' '}
            <strong className="text-foreground">{user.neighbourhoodName}</strong>
          </p>
        ) : (
          <p className="text-muted-foreground">{t('home.noNeighbourhood')}</p>
        )}
      </CardContent>
    </Card>
  );
}
