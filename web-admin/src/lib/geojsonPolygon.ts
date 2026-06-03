import L from 'leaflet';
import type { PolygonGeoJson } from '../types/neighbourhood.js';

function qlonLat(lon: number, lat: number): [number, number] {
  return [Number(lon.toFixed(8)), Number(lat.toFixed(8))];
}

function closeLinearRing(ringRaw: number[][]): number[][] {
  if (ringRaw.length < 3) throw new Error('Anneau incomplet.');
  const ring = ringRaw.map((pos) => qlonLat(Number(pos[0]), Number(pos[1] ?? Number.NaN)));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) throw new Error('Anneau incomplet.');
  const closed =
    first[0] === last[0] && first[1] === last[1]
      ? ring
      : [...ring, [first[0], first[1]] as [number, number]];
  if (closed.length < 4) throw new Error('Polygone fermé incomplet.');
  return closed;
}

export function polygonFromPmLayer(layer: L.Layer): PolygonGeoJson {
  const gj = (layer as L.Polygon).toGeoJSON() as
    | GeoJSON.Feature<GeoJSON.Polygon>
    | GeoJSON.Polygon;

  let geometry: GeoJSON.Polygon;
  if (gj.type === 'Feature' && gj.geometry?.type === 'Polygon') {
    geometry = gj.geometry;
  } else if (gj.type === 'Polygon') {
    geometry = gj;
  } else {
    throw new Error('Contour non polygonal.');
  }

  const coordinates = geometry.coordinates.map((ring) => closeLinearRing(ring as number[][]));
  return { type: 'Polygon', coordinates };
}
