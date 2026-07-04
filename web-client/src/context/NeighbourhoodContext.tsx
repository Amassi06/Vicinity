import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from './AuthContext.js';
import type { NeighbourhoodDto } from '../types/neighbourhood.js';

type CtxValue = {
  list: NeighbourhoodDto[];
  loading: boolean;
  /** Quartier de rattachement de l'utilisateur connecté (statique, choisi à l'inscription). */
  selectedId: string | null;
  selected: NeighbourhoodDto | null;
  reload: () => Promise<void>;
};

const Ctx = createContext<CtxValue | null>(null);

export function NeighbourhoodProvider({ children }: { children: ReactNode }): ReactElement {
  const { user } = useAuth();
  const [list, setList] = useState<NeighbourhoodDto[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<NeighbourhoodDto[]>('/neighbourhoods');
      setList(rows);
    } catch {
      setList([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) void reload();
  }, [reload, user]);

  const selectedId = user?.neighbourhoodId ?? null;

  const selected = useMemo(
    () => list.find((n) => n.id === selectedId) ?? null,
    [list, selectedId],
  );

  const value = useMemo(
    (): CtxValue => ({
      list,
      loading,
      selectedId,
      selected,
      reload,
    }),
    [list, loading, selectedId, selected, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNeighbourhoods(): CtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNeighbourhoods hors provider');
  return v;
}
