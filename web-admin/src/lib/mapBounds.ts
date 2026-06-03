import L from 'leaflet';
import type { PolygonGeoJson } from '../types/neighbourhood.js';

export type NeighbourhoodMapView = {
  center: [number, number];
  zoom: number;
  maxBounds: L.LatLngBounds;
};

export function neighbourhoodMapView(boundaries: PolygonGeoJson[]): NeighbourhoodMapView | null {
  if (boundaries.length === 0) return null;

  const fg = L.featureGroup();
  for (const b of boundaries) {
    fg.addLayer(L.geoJSON(b as GeoJSON.GeoJsonObject));
  }
  const bounds = fg.getBounds();
  if (!bounds.isValid()) return null;

  const padded = bounds.pad(0.1);
  const center = padded.getCenter();

  return {
    center: [center.lat, center.lng],
    zoom: 14,
    maxBounds: padded.pad(0.4),
  };
}
