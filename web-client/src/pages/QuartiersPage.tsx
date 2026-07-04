import { type ReactElement } from 'react';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { QuartiersExplorerMap } from '../components/QuartiersExplorerMap.js';
import { useT } from '../i18n/I18nContext.js';

export function QuartiersPage(): ReactElement {
  const { list, loading } = useNeighbourhoods();
  const t = useT();

  if (loading) return <p className="text-muted-foreground">{t('quartiers.loading')}</p>;

  return (
    <section>
      <h1 className="mt-0 text-2xl font-semibold">{t('quartiers.title')}</h1>
      <QuartiersExplorerMap items={list} />
    </section>
  );
}
