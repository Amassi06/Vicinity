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
import type { NeighbourhoodDto } from '../types/neighbourhood.js';

const STORAGE_KEY = 'vicinity_selected_neighbourhood';

type CtxValue = {
  list: NeighbourhoodDto[];
  loading: boolean;
  selectedId: string | null;
  selected: NeighbourhoodDto | null;
  setSelectedId: (id: string | null) => void;
  reload: () => Promise<void>;
};

const Ctx = createContext<CtxValue | null>(null);

export function NeighbourhoodProvider({ children }: { children: ReactNode }): ReactElement {
  const [list, setList] = useState<NeighbourhoodDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedIdState] = useState<string | null>(
    () => sessionStorage.getItem(STORAGE_KEY),
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<NeighbourhoodDto[]>('/neighbourhoods');
      setList(rows);
      setSelectedIdState((prev) => {
        if (prev && !rows.some((r) => r.id === prev)) {
          sessionStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return prev;
      });
    } catch {
      setList([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id);
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  }, []);

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
      setSelectedId,
      reload,
    }),
    [list, loading, selectedId, selected, setSelectedId, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNeighbourhoods(): CtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNeighbourhoods hors provider');
  return v;
}
