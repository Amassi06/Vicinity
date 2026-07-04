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

const ZONE_A = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [2.30, 48.80],
      [2.40, 48.80],
      [2.40, 48.90],
      [2.30, 48.90],
      [2.30, 48.80],
    ],
  ],
};

// Overlap intentionnel avec ZONE_A
const ZONE_B = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [2.35, 48.85],
      [2.45, 48.85],
      [2.45, 48.95],
      [2.35, 48.95],
      [2.35, 48.85],
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
    await prisma.$executeRawUnsafe(`DELETE FROM neighbourhoods WHERE name LIKE '__test__%'`);
    await prisma.session.deleteMany({ where: { userId: adminId } });
    await prisma.user.delete({ where: { id: adminId } });
    await prisma.$disconnect();
  }, TIMEOUT_MS);

  it('point inside ZONE_A only returns only A', async () => {
    const res = await request(app)
      .get('/neighbourhoods/lookup/point?lon=2.32&lat=48.82')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const matches = (res.body as { matches: Neighbourhood[] }).matches;
    expect(matches.map((m) => m.id)).toEqual([zoneAId]);
  });

  it('point in overlap returns both A and B', async () => {
    const res = await request(app)
      .get('/neighbourhoods/lookup/point?lon=2.37&lat=48.87')
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
