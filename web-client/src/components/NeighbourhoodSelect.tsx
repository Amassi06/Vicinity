import type { ReactElement } from 'react';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';

export function NeighbourhoodSelect({ label }: { label?: string }): ReactElement {
  const { list, loading, selectedId, setSelectedId } = useNeighbourhoods();

  return (
    <label className="field-block">
      <span>{label ?? 'Quartier actif'}</span>
      <select
        value={selectedId ?? ''}
        disabled={loading || list.length === 0}
        onChange={(e) => setSelectedId(e.target.value || null)}
      >
        <option value="">— Choisir un quartier —</option>
        {list.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>
    </label>
  );
}
