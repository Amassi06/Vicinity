/**
 * Geoman (bundle IIFE) exige `L` sur globalThis — les imports statiques seraient exécutés trop tôt.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export async function initLeafletGeoman(): Promise<void> {
  const g = globalThis as typeof globalThis & { L: typeof L };
  g.L = L;
  await import('@geoman-io/leaflet-geoman-free');
  await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css');
}
