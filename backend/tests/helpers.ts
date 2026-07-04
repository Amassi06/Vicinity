import { prisma } from '../src/db/prisma';

/**
 * Quartier de test partagé par les suites d'intégration : le signup exige
 * désormais un `neighbourhoodId` valide. UUID fixe + upsert idempotent, pour
 * que les suites puissent tourner dans n'importe quel ordre sans se marcher
 * dessus ni laisser de doublons.
 */
export const TEST_NEIGHBOURHOOD_ID = '00000000-0000-4000-8000-00000000cafe';

export async function ensureTestNeighbourhood(): Promise<string> {
  // Petit polygone au cœur de Paris : même si ce quartier de test reste en base
  // entre deux exécutions, il ne décentre pas la carte hors de Paris Centre.
  await prisma.$executeRaw`
    INSERT INTO neighbourhoods (id, name, boundary, updated_at)
    VALUES (
      ${TEST_NEIGHBOURHOOD_ID}::uuid,
      '__test__shared_neighbourhood',
      ST_GeomFromText('POLYGON((2.34 48.85, 2.36 48.85, 2.36 48.86, 2.34 48.86, 2.34 48.85))', 4326),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  `;
  return TEST_NEIGHBOURHOOD_ID;
}
