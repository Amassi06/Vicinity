/**
 * Test E2E spatial — point-in-polygon + détection de chevauchement.
 * Requiert Postgres (`make up`) avec PostGIS.
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { ensureTestNeighbourhood } from './helpers';

const TIMEOUT_MS = 20_000;

interface AuthBody {
  accessToken: string;
  user: { id: string };
}
interface Neighbourhood {
  id: string;
  name: string;
}

// Zones volontairement éloignées de Paris : le quartier partagé des tests
// (`ensureTestNeighbourhood`, Paris centre) ne doit pas interférer avec les
// assertions de chevauchement.
const ZONE_A = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [20.30, 45.80],
      [20.40, 45.80],
      [20.40, 45.90],
      [20.30, 45.90],
      [20.30, 45.80],
    ],
  ],
};

// Overlap intentionnel avec ZONE_A
const ZONE_B = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [20.35, 45.85],
      [20.45, 45.85],
      [20.45, 45.95],
      [20.35, 45.95],
      [20.35, 45.85],
    ],
  ],
};

async function makeAdmin(app: ReturnType<typeof createApp>, email: string): Promise<{ token: string; id: string }> {
  const signup = await request(app)
    .post('/auth/signup')
    .send({ email, password: 'sup3rstrongpass', displayName: 'Admin', neighbourhoodId: await ensureTestNeighbourhood() });
  const { user } = signup.body as AuthBody;
  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  const relogin = await request(app)
    .post('/auth/login')
    .send({ email, password: 'sup3rstrongpass' });
  return { token: (relogin.body as AuthBody).accessToken, id: user.id };
}

describe('Neighbourhood spatial queries', () => {
  const app = createApp();
  let adminToken = '';
  let adminId = '';
  let zoneAId = '';
  let zoneBId = '';

  beforeAll(async () => {
    await prisma.$connect();
    const admin = await makeAdmin(app, `__test__spatial_${Date.now()}@example.com`);
    adminToken = admin.token;
    adminId = admin.id;

    const a = await request(app)
      .post('/neighbourhoods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `__test__A_${Date.now()}`, boundary: ZONE_A });
    zoneAId = (a.body as Neighbourhood).id;

    const b = await request(app)
      .post('/neighbourhoods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `__test__B_${Date.now()}`, boundary: ZONE_B });
    zoneBId = (b.body as Neighbourhood).id;
  }, TIMEOUT_MS);

  afterAll(async () => {
    // Uniquement les zones de cette suite : le quartier partagé reste en place.
    await prisma.$executeRawUnsafe(
      `DELETE FROM neighbourhoods WHERE name LIKE '__test__A\\_%' OR name LIKE '__test__B\\_%'`,
    );
    await prisma.session.deleteMany({ where: { userId: adminId } });
    await prisma.user.delete({ where: { id: adminId } });
    await prisma.$disconnect();
  }, TIMEOUT_MS);

  it('point inside ZONE_A only returns only A', async () => {
    const res = await request(app)
      .get('/neighbourhoods/lookup/point?lon=20.32&lat=45.82')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const matches = (res.body as { matches: Neighbourhood[] }).matches;
    expect(matches.map((m) => m.id)).toEqual([zoneAId]);
  });

  it('point in overlap returns both A and B', async () => {
    const res = await request(app)
      .get('/neighbourhoods/lookup/point?lon=20.37&lat=45.87')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const ids = (res.body as { matches: Neighbourhood[] }).matches.map((m) => m.id).sort();
    expect(ids).toEqual([zoneAId, zoneBId].sort());
  });

  it('point outside returns nothing', async () => {
    const res = await request(app)
      .get('/neighbourhoods/lookup/point?lon=0&lat=0')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect((res.body as { matches: Neighbourhood[] }).matches).toEqual([]);
  });

  it('overlap detection lists B as overlapping with A', async () => {
    const res = await request(app)
      .get(`/neighbourhoods/${zoneAId}/overlaps`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const overlaps = (res.body as { overlaps: { id: string; overlapArea: number }[] }).overlaps;
    expect(overlaps.length).toBe(1);
    expect(overlaps[0]?.id).toBe(zoneBId);
    expect(overlaps[0]?.overlapArea).toBeGreaterThan(0);
  });

  it('rejects out-of-range coordinates', async () => {
    const res = await request(app)
      .get('/neighbourhoods/lookup/point?lon=999&lat=0')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});
