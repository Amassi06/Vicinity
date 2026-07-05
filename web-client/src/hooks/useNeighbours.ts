import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

export type Neighbour = { id: string; displayName: string; online: boolean };

/** Source unique des habitants du quartier de l'utilisateur connecté. */
export function useNeighbours(): { neighbours: Neighbour[]; loading: boolean } {
  const [neighbours, setNeighbours] = useState<Neighbour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiFetch<{ items: Neighbour[] }>('/me/neighbours')
      .then((response) => {
        if (mounted) setNeighbours(response.items);
      })
      .catch(() => {
        if (mounted) setNeighbours([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { neighbours, loading };
}
