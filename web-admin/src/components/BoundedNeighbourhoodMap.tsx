import { useMemo, type ReactElement, type ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { FitNeighbourhoodsBounds } from './FitNeighbourhoodsBounds.js';
import { neighbourhoodMapView } from '../lib/mapBounds.js';
import type { PolygonGeoJson } from '../types/neighbourhood.js';

type Props = {
  boundaries: PolygonGeoJson[];
  drawBootstrap?: [number, number] | null;
  className?: string;
  children?: ReactNode;
};

export function BoundedNeighbourhoodMap({
  boundaries,
  drawBootstrap,
  className,
  children,
}: Props): ReactElement {
  const view = useMemo(() => {
    const fromData = neighbourhoodMapView(boundaries);
    if (fromData) return fromData;
    if (!drawBootstrap) return null;
    const [lat, lon] = drawBootstrap;
    const center = L.latLng(lat, lon);
    const maxBounds = center.toBounds(1200);
    return { center: [lat, lon] as [number, number], zoom: 15, maxBounds };
  }, [boundaries, drawBootstrap]);

  if (!view) {
    return (
      <div
        className={
          className ??
          'flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-input bg-card p-8 text-center'
        }
      >
        <p>Aucun quartier sur la carte.</p>
        <p className="max-w-md text-muted-foreground">
          Cliquez « Nouveau tracé » : la carte se centre sur votre position (ou autorisez la
          géolocalisation) pour dessiner le premier périmètre.
        </p>
      </div>
    );
  }

  const mapKey = `${boundaries.length}:${view.center.join(',')}`;

  return (
    <div className={className ?? 'h-[min(72vh,640px)] min-h-96 overflow-hidden rounded-lg border border-border'}>
      <MapContainer
        key={mapKey}
        center={view.center}
        zoom={view.zoom}
        minZoom={13}
        maxZoom={19}
        maxBounds={view.maxBounds}
        maxBoundsViscosity={1}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="© OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {boundaries.length > 0 ? <FitNeighbourhoodsBounds boundaries={boundaries} /> : null}
        {children}
      </MapContainer>
    </div>
  );
}
