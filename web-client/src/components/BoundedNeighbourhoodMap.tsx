import { useMemo, type ReactElement, type ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { FitNeighbourhoodsBounds } from './FitNeighbourhoodsBounds.js';
import { neighbourhoodMapView } from '../lib/mapBounds.js';
import type { PolygonGeoJson } from '../types/neighbourhood.js';

type Props = {
  boundaries: PolygonGeoJson[];
  className?: string;
  children?: ReactNode;
};

/** Carte OSM cantonnée aux périmètres — vue par défaut Paris Centre. */
export function BoundedNeighbourhoodMap({ boundaries, className, children }: Props): ReactElement {
  const view = useMemo(() => neighbourhoodMapView(boundaries), [boundaries]);

  const mapKey =
    boundaries.length > 0
      ? boundaries.map((b) => JSON.stringify(b.coordinates[0]?.[0])).join('|')
      : 'paris-centre';

  return (
    <div
      className={className ?? 'h-[min(72vh,640px)] min-h-96 overflow-hidden rounded-lg border border-border'}
    >
      <MapContainer
        key={mapKey}
        center={view.center}
        zoom={view.zoom}
        minZoom={11}
        maxZoom={18}
        maxBounds={view.maxBounds}
        maxBoundsViscosity={1}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="© OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitNeighbourhoodsBounds boundaries={boundaries} />
        {children}
      </MapContainer>
    </div>
  );
}
