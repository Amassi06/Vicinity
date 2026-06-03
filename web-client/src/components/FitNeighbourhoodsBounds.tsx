import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import type { PolygonGeoJson } from '../types/neighbourhood.js';

export function FitNeighbourhoodsBounds({ boundaries }: { boundaries: PolygonGeoJson[] }): null {
  const map = useMap();

  useEffect(() => {
    if (boundaries.length === 0) return;
    const fg = L.featureGroup();
    for (const b of boundaries) {
      fg.addLayer(L.geoJSON(b as GeoJSON.GeoJsonObject));
    }
    const bounds = fg.getBounds().pad(0.08);
    map.fitBounds(bounds, { maxZoom: 17, animate: false });
    map.setMinZoom(Math.max(map.getZoom() - 2, 12));
  }, [map, boundaries]);

  return null;
}
