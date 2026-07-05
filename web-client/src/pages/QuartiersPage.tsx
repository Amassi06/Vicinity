import { type ReactElement } from 'react';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { QuartiersExplorerMap } from '../components/QuartiersExplorerMap.js';
import { useT } from '../i18n/I18nContext.js';
import { PageHeader } from '../components/PageHeader.js';
import { Skeleton } from '@/components/ui/skeleton.js';

export function QuartiersPage(): ReactElement {
  const { list, loading } = useNeighbourhoods();
  const t = useT();

  return (
    <section>
      <PageHeader title={t('quartiers.title')} />
      {loading ? <Skeleton className="h-96" /> : <QuartiersExplorerMap items={list} />}
    </section>
  );
}
