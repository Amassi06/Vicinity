import { useCallback, useMemo, type ReactElement, useState } from 'react';
import { GeoJSON, Popup, useMapEvents } from 'react-leaflet';
import { BoundedNeighbourhoodMap } from './BoundedNeighbourhoodMap.js';
import { styleForNeighbourhoodId } from '../lib/mapStyle.js';
import type { NeighbourhoodDto } from '../types/neighbourhood.js';
import { apiFetch } from '../lib/api.js';

type LookupMatch = { id: string; name: string };

function MapInspectClick({ onPick }: { onPick: (lat: number, lon: number) => void }): null {
  useMapEvents({
    click(ev) {
      onPick(ev.latlng.lat, ev.latlng.lng);
    },
  });
  return null;
}

export function QuartiersExplorerMap({ items }: { items: NeighbourhoodDto[] }): ReactElement {
  const boundaries = useMemo(() => items.map((n) => n.boundary), [items]);
  const [lookupMatches, setLookupMatches] = useState<LookupMatch[] | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  const inspectPoint = useCallback(async (lat: number, lon: number) => {
    setLookupBusy(true);
    setLookupMatches(null);
    try {
      const res = await apiFetch<{ matches: LookupMatch[] }>(
        `/neighbourhoods/lookup/point?lon=${encodeURIComponent(String(lon))}&lat=${encodeURIComponent(String(lat))}`,
      );
      setLookupMatches(res.matches);
    } catch {
      setLookupMatches([]);
    }
    setLookupBusy(false);
  }, []);

  return (
    <div>
      <p className="mb-2.5 text-muted-foreground">
        Modélisation PostGIS : chaque contour est le polygone GeoJSON du quartier. Cliquez dans un
        périmètre pour un lookup <code>/neighbourhoods/lookup/point</code>.
      </p>
      <BoundedNeighbourhoodMap boundaries={boundaries}>
        {items.map((n) => (
          <GeoJSON
            key={n.id}
            data={
              {
                type: 'Feature',
                properties: { name: n.name },
                geometry: n.boundary,
              } as GeoJSON.Feature
            }
            style={() => {
              const s = styleForNeighbourhoodId(n.id);
              return {
                fillColor: s.color,
                color: s.color,
                fillOpacity: s.fillOpacity,
                weight: 2,
              };
            }}
          >
            <Popup>
              <strong>{n.name}</strong>
              <div style={{ opacity: 0.85 }}>
                {n.description ? n.description.slice(0, 200) : 'Sans description'}
              </div>
            </Popup>
          </GeoJSON>
        ))}
        {boundaries.length > 0 ? <MapInspectClick onPick={inspectPoint} /> : null}
      </BoundedNeighbourhoodMap>
      {boundaries.length > 0 ? (
        <div className="mt-3 rounded-lg border border-border bg-card px-3.5 py-2.5">
          {lookupBusy ? (
            <p style={{ margin: 0 }}>Calcul quartier…</p>
          ) : lookupMatches ? (
            lookupMatches.length ? (
              <div>
                <p style={{ marginTop: 0 }}>Ce point est dans :</p>
                <ul style={{ margin: '0.25rem 0 0' }}>
                  {lookupMatches.map((m) => (
                    <li key={m.id}>{m.name}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ margin: 0 }}>Point hors des périmètres connus.</p>
            )
          ) : (
            <p style={{ margin: 0, opacity: 0.72 }}>Cliquez la carte pour tester le lookup.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
