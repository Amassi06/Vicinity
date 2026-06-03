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

/** Carte OSM cantonnée aux périmètres — sans vue « monde ». */
export function BoundedNeighbourhoodMap({ boundaries, className, children }: Props): ReactElement {
  const view = useMemo(() => neighbourhoodMapView(boundaries), [boundaries]);

  if (!view) {
    return (
      <div className={className ?? 'map-empty'}>
        <p>Aucun périmètre de quartier modélisé.</p>
        <p className="map-empty-hint">
          Un administrateur doit tracer des polygones dans le back-office Vicinity Admin.
        </p>
      </div>
    );
  }

  const mapKey = boundaries.map((b) => JSON.stringify(b.coordinates[0]?.[0])).join('|');

  return (
    <div className={className ?? 'map-wrap'}>
      <MapContainer
        key={mapKey}
        center={view.center}
        zoom={view.zoom}
        minZoom={12}
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
