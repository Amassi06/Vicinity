import L from 'leaflet';
import type { PolygonGeoJson } from '../types/neighbourhood.js';

export type NeighbourhoodMapView = {
  center: [number, number];
  zoom: number;
  maxBounds: L.LatLngBounds | undefined;
};

/** Centre par défaut : Paris Centre (Île de la Cité). Pas de géolocalisation. */
export const PARIS_CENTER: [number, number] = [48.8566, 2.3522];
const PARIS_DEFAULT_ZOOM = 12;

/** Vue carte limitée aux périmètres modélisés (pas de carte du monde). */
export function neighbourhoodMapView(boundaries: PolygonGeoJson[]): NeighbourhoodMapView {
  if (boundaries.length === 0) {
    return { center: PARIS_CENTER, zoom: PARIS_DEFAULT_ZOOM, maxBounds: undefined };
  }

  const fg = L.featureGroup();
  for (const b of boundaries) {
    fg.addLayer(L.geoJSON(b as GeoJSON.GeoJsonObject));
  }
  const bounds = fg.getBounds();
  if (!bounds.isValid()) {
    return { center: PARIS_CENTER, zoom: PARIS_DEFAULT_ZOOM, maxBounds: undefined };
  }

  const padded = bounds.pad(0.1);
  const center = padded.getCenter();

  return {
    center: [center.lat, center.lng],
    zoom: 14,
    maxBounds: padded.pad(0.4),
  };
}
