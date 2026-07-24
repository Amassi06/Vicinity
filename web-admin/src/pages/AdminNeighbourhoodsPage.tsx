import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  AdminNeighbourhoodMap,
  type MapDrawBridge,
} from '../components/AdminNeighbourhoodMap.js';
import type { NeighbourhoodDto, PolygonGeoJson } from '../types/neighbourhood.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { cn } from '@/lib/utils.js';

/** Centre de secours (échelle quartier, pas vue monde) si la géoloc est refusée. */
const FALLBACK_MAP_CENTER: [number, number] = [45.764, 4.8357];

function requestGeolocation(): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('no_geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => reject(new Error('denied')),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  });
}

export function AdminNeighbourhoodsPage(): ReactElement {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [items, setItems] = useState<NeighbourhoodDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [geomHint, setGeomHint] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [draftBoundary, setDraftBoundary] = useState<PolygonGeoJson | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');

  const [drawBootstrap, setDrawBootstrap] = useState<[number, number] | null>(null);
  const [overlapRows, setOverlapRows] = useState<
    { id: string; name: string; overlapArea: number }[] | null
  >(null);

  const boundaryReplaceTargetRef = useRef<string | null>(null);
  const bridgeRef = useRef<MapDrawBridge | null>(null);
  const pendingDrawRef = useRef(false);

  const flushPendingDraw = useCallback(() => {
    if (!pendingDrawRef.current || !bridgeRef.current) return;
    if (items.length === 0 && drawBootstrap === null) return;
    pendingDrawRef.current = false;
    bridgeRef.current.drawPolygon();
  }, [items.length, drawBootstrap]);

  useEffect(() => {
    flushPendingDraw();
  }, [flushPendingDraw]);

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const rows = await apiFetch<NeighbourhoodDto[]>('/neighbourhoods');
      setItems(rows);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Erreur chargement';
      if (raw === 'Failed to fetch' || raw.includes('NetworkError')) {
        setErr('Backend injoignable — lancez « cd backend && npm run dev » (port 3000).');
      } else if (raw === 'missing_token' || raw === 'invalid_token') {
        setErr('Session expirée — reconnectez-vous.');
      } else {
        setErr(raw);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Prépare la carte dès qu’un admin arrive (évite l’écran vide sans action). */
  useEffect(() => {
    if (!isAdmin || items.length > 0 || drawBootstrap !== null) return;
    let cancelled = false;
    void requestGeolocation()
      .then((pos) => {
        if (!cancelled) setDrawBootstrap(pos);
      })
      .catch(() => {
        /* attendre le clic « Nouveau tracé » */
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, items.length, drawBootstrap]);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    setEditName(selected?.name ?? '');
    setEditDesc(selected?.description ?? '');
  }, [selected]);

  useEffect(() => {
    let alive = true;
    async function load(): Promise<void> {
      if (!isAdmin || !selectedId) {
        setOverlapRows(null);
        return;
      }
      try {
        const res = await apiFetch<{ overlaps: { id: string; name: string; overlapArea: number }[] }>(
          `/neighbourhoods/${selectedId}/overlaps`,
        );
        if (alive) setOverlapRows(res.overlaps);
      } catch {
        if (alive) setOverlapRows(null);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [selectedId, isAdmin]);

  const onPolygonCaptured = useCallback(
    async (boundary: PolygonGeoJson) => {
      setGeomHint(null);
      const replaceFor = boundaryReplaceTargetRef.current;
      boundaryReplaceTargetRef.current = null;

      if (replaceFor) {
        setBusy(true);
        try {
          await apiFetch(`/neighbourhoods/${replaceFor}`, { method: 'PATCH', json: { boundary } });
          setMsg('Contour mis à jour.');
          await reload();
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Échec mise à jour');
        }
        setBusy(false);
        return;
      }

      setDraftBoundary(boundary);
      setDraftName('');
      setDraftDesc('');
    },
    [reload],
  );

  async function ensureDrawMap(): Promise<void> {
    if (items.length > 0) {
      setDrawBootstrap(null);
      return;
    }
    try {
      const pos = await requestGeolocation();
      setDrawBootstrap(pos);
    } catch {
      setDrawBootstrap(FALLBACK_MAP_CENTER);
      setGeomHint(
        'Géolocalisation refusée : carte centrée sur une zone par défaut (Lyon). Vous pouvez tracer quand même.',
      );
    }
  }

  async function startDraw(): Promise<void> {
    if (!isAdmin) {
      setGeomHint('Compte ADMIN requis (Prisma Studio → users.role = ADMIN, puis F5).');
      return;
    }
    boundaryReplaceTargetRef.current = null;
    pendingDrawRef.current = true;
    if (items.length === 0 && drawBootstrap === null) {
      await ensureDrawMap();
    }
    flushPendingDraw();
  }

  function startReplaceBoundary(): void {
    if (!selectedId || !isAdmin) return;
    boundaryReplaceTargetRef.current = selectedId;
    pendingDrawRef.current = true;
    flushPendingDraw();
  }

  async function submitCreate(): Promise<void> {
    if (!draftBoundary) return;
    const name = draftName.trim();
    if (!name) {
      setMsg('Nom requis.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/neighbourhoods', {
        method: 'POST',
        json: {
          name,
          description: draftDesc.trim() || undefined,
          boundary: draftBoundary,
        },
      });
      setMsg('Quartier créé.');
      setDraftBoundary(null);
      setDrawBootstrap(null);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Création refusée');
    }
    setBusy(false);
  }

  async function saveMeta(): Promise<void> {
    if (!selectedId) return;
    setBusy(true);
    try {
      await apiFetch(`/neighbourhoods/${selectedId}`, {
        method: 'PATCH',
        json: { name: editName.trim(), description: editDesc.trim() },
      });
      setMsg('Fiche enregistrée.');
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
    setBusy(false);
  }

  async function removeSelected(): Promise<void> {
    if (!selectedId || !window.confirm('Supprimer ce quartier ?')) return;
    setBusy(true);
    try {
      await apiFetch(`/neighbourhoods/${selectedId}`, { method: 'DELETE' });
      setSelectedId(null);
      setMsg('Quartier supprimé.');
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Suppression refusée');
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-52px)]">
      <aside className="w-[min(340px,38vw)] shrink-0 overflow-auto border-r border-border bg-background/60 p-4">
        <h1 className="mt-0 text-lg font-semibold">Quartiers</h1>
        {user ? (
          <p className="my-3 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm">
            Connecté : {user.email} — rôle <Badge variant="secondary">{user.role}</Badge>
            {user.role !== 'ADMIN' ? ' (lecture seule)' : ''}
          </p>
        ) : null}
        {!isAdmin ? (
          <Alert variant="destructive" className="mb-2">
            <AlertDescription>
              Rôle <strong>ADMIN</strong> requis pour créer ou modifier. Mettez à jour{' '}
              <code>users.role</code> en base puis actualisez (F5).
            </AlertDescription>
          </Alert>
        ) : null}
        {geomHint ? (
          <Alert variant="destructive" className="mb-2">
            <AlertDescription>{geomHint}</AlertDescription>
          </Alert>
        ) : null}
        {err ? (
          <Alert variant="destructive" className="mb-2">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
        {msg ? <p className="mb-2">{msg}</p> : null}

        <div className="my-2.5 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void reload()}>
            Recharger
          </Button>
          <Button type="button" disabled={!isAdmin || busy} onClick={() => void startDraw()}>
            Nouveau tracé
          </Button>
        </div>

        <h2 className="mb-2 mt-4 text-base font-semibold">Liste ({items.length})</h2>
        <ul className="max-h-[28vh] list-none space-y-1 overflow-auto p-0">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={cn(
                  'w-full rounded-md border border-transparent px-2 py-1.5 text-left hover:bg-accent',
                  n.id === selectedId && 'border-amber-400 bg-amber-400/10',
                )}
                onClick={() => setSelectedId(n.id)}
              >
                {n.name}
              </button>
            </li>
          ))}
        </ul>

        {draftBoundary ? (
          <section className="mt-4 border-t border-dashed border-input pt-3">
            <h3 className="font-semibold">Nouveau quartier</h3>
            <div className="mt-2 space-y-1.5">
              <Label htmlFor="dn">Nom</Label>
              <Input id="dn" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </div>
            <div className="mt-2 space-y-1.5">
              <Label htmlFor="dd">Description</Label>
              <Textarea id="dd" rows={2} value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button type="button" disabled={!isAdmin || busy} onClick={() => void submitCreate()}>
                Créer
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDraftBoundary(null)}>
                Annuler
              </Button>
            </div>
          </section>
        ) : null}

        {selected ? (
          <section className="mt-4 border-t border-dashed border-input pt-3">
            <h3 className="font-semibold">{selected.name}</h3>
            <div className="mt-2 space-y-1.5">
              <Label htmlFor="en">Nom</Label>
              <Input id="en" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="mt-2 space-y-1.5">
              <Label htmlFor="ed">Description</Label>
              <Textarea id="ed" rows={2} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button type="button" disabled={!isAdmin || busy} onClick={() => void saveMeta()}>
                Enregistrer
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!isAdmin || busy}
                onClick={() => void startReplaceBoundary()}
              >
                Remplacer contour
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!isAdmin || busy}
                onClick={() => void removeSelected()}
              >
                Supprimer
              </Button>
            </div>
          </section>
        ) : null}

        {overlapRows?.length ? (
          <section className="mt-4">
            <h4 className="font-semibold">Chevauchements</h4>
            <ul className="pl-4 text-sm">
              {overlapRows.map((o) => (
                <li key={o.id}>
                  {o.name} (≈ {o.overlapArea.toExponential(2)})
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>

      <div className="min-w-0 flex-1 p-3">
        <AdminNeighbourhoodMap
          bridge={bridgeRef}
          items={items}
          selectedId={selectedId}
          drawBootstrap={drawBootstrap}
          onClearSelection={() => setSelectedId(null)}
          onSelectContour={setSelectedId}
          canDraw={isAdmin}
          onPolygonComplete={onPolygonCaptured}
          onDrawError={setGeomHint}
          onAbortDrawing={() => {
            boundaryReplaceTargetRef.current = null;
          }}
          onBridgeReady={flushPendingDraw}
        />
      </div>
    </div>
  );
}
