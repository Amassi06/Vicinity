/**
 * Tests E2E statistiques de participation (admin uniquement).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import { ListingModel } from '../src/db/mongo/models';
import { ensureTestNeighbourhood } from './helpers';

const TIMEOUT_MS = 30_000;
const STAMP = Date.now();
const RESIDENT = `__stats_resident_${STAMP}@example.com`;
const ADMIN = `__stats_admin_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';
const CATEGORY_SLUG = `__stats-cat-${STAMP}`;
let NEIGHBOURHOOD_ID = '';

interface AuthBody {
  accessToken: string;
  user: { id: string };
}

async function signup(app: ReturnType<typeof createApp>, email: string): Promise<AuthBody> {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: PASSWORD, displayName: email, neighbourhoodId: await ensureTestNeighbourhood() });
  return res.body as AuthBody;
}

describe('Admin stats — participation counts', () => {
  const app = createApp();
  let residentId = '';
  let residentToken = '';
  let adminId = '';
  let adminToken = '';
  let listingId = '';

  beforeAll(async () => {
    await Promise.all([prisma.$connect(), connectMongo()]);
    NEIGHBOURHOOD_ID = await ensureTestNeighbourhood();
    await prisma.listingCategory.upsert({
      where: { slug: CATEGORY_SLUG },
      update: {},
      create: { slug: CATEGORY_SLUG, label: 'Catégorie stats' },
    });
    const resident = await signup(app, RESIDENT);
    residentId = resident.user.id;
    residentToken = resident.accessToken;

    const admin = await signup(app, ADMIN);
    adminId = admin.user.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
    const login = await request(app).post('/auth/login').send({ email: ADMIN, password: PASSWORD });
    adminToken = (login.body as AuthBody).accessToken;

    const listing = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ stats listing',
        kind: 'offer',
        category: CATEGORY_SLUG,
        pricePoints: 0,
      });
    listingId = (listing.body as { _id: string })._id;
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (listingId) await ListingModel.deleteOne({ _id: listingId });
    await prisma.listingCategory.deleteMany({ where: { slug: CATEGORY_SLUG } });
    const ids = [residentId, adminId].filter(Boolean);
    if (ids.length) {
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await Promise.all([prisma.$disconnect(), disconnectMongo()]);
  }, TIMEOUT_MS);

  it('rejects non-admins', async () => {
    const res = await request(app)
      .get(`/admin/stats?neighbourhoodId=${NEIGHBOURHOOD_ID}`)
      .set('Authorization', `Bearer ${residentToken}`);
    expect(res.status).toBe(403);
  });

  it('returns participation counts for admins', async () => {
    const res = await request(app)
      .get(`/admin/stats?neighbourhoodId=${NEIGHBOURHOOD_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const body = res.body as { listings: number };
    expect(body.listings).toBeGreaterThanOrEqual(1);
  });
});
