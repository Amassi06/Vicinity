import { type ReactElement } from 'react';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { QuartiersExplorerMap } from '../components/QuartiersExplorerMap.js';

export function QuartiersPage(): ReactElement {
  const { list, loading } = useNeighbourhoods();

  if (loading) return <p className="muted">Chargement des périmètres…</p>;

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Modélisation des quartiers</h1>
      <QuartiersExplorerMap items={list} />
    </section>
  );
}
