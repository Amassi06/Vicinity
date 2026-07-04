/**
 * Tests E2E incidents — signalement, liste, changement de statut (admin) et
 * résolution de conflit optimiste (expectedUpdatedAt).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import { IncidentModel } from '../src/db/mongo/models';
import { ensureTestNeighbourhood } from './helpers';

const TIMEOUT_MS = 30_000;
const STAMP = Date.now();
const RESIDENT = `__incident_resident_${STAMP}@example.com`;
const ADMIN = `__incident_admin_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';
const NEIGHBOURHOOD_ID = '00000000-0000-0000-0000-000000000002';

interface AuthBody {
  accessToken: string;
  user: { id: string };
}

interface IncidentResp {
  _id: string;
  status: string;
  updatedAt: string;
}

async function signup(app: ReturnType<typeof createApp>, email: string): Promise<AuthBody> {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: PASSWORD, displayName: email, neighbourhoodId: await ensureTestNeighbourhood() });
  return res.body as AuthBody;
}

describe('Incidents — report, list, admin status update', () => {
  const app = createApp();
  let residentId = '';
  let residentToken = '';
  let adminId = '';
  let adminToken = '';
  let incidentId = '';

  beforeAll(async () => {
    await Promise.all([prisma.$connect(), connectMongo()]);
    const resident = await signup(app, RESIDENT);
    residentId = resident.user.id;
    residentToken = resident.accessToken;

    const admin = await signup(app, ADMIN);
    adminId = admin.user.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
    const login = await request(app).post('/auth/login').send({ email: ADMIN, password: PASSWORD });
    adminToken = (login.body as AuthBody).accessToken;

    await prisma.incidentCategory.upsert({
      where: { slug: 'securite' },
      update: {},
      create: { slug: 'securite', label: 'Sécurité' },
    });
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (incidentId) await IncidentModel.deleteOne({ _id: incidentId });
    const ids = [residentId, adminId].filter(Boolean);
    if (ids.length) {
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await Promise.all([prisma.$disconnect(), disconnectMongo()]);
  }, TIMEOUT_MS);

  it('a resident reports an incident', async () => {
    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ lampadaire cassé',
        description: 'rue principale',
        category: 'securite',
      });
    expect(res.status).toBe(201);
    const body = res.body as IncidentResp;
    expect(body.status).toBe('open');
    incidentId = body._id;
  });

  it('lists incidents for the neighbourhood', async () => {
    const res = await request(app)
      .get(`/incidents?neighbourhoodId=${NEIGHBOURHOOD_ID}`)
      .set('Authorization', `Bearer ${residentToken}`);
    expect(res.status).toBe(200);
    const body = res.body as { items: IncidentResp[] };
    expect(body.items.some((i) => i._id === incidentId)).toBe(true);
  });

  it('a non-admin cannot change incident status', async () => {
    const res = await request(app)
      .patch(`/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${residentToken}`)
      .send({ status: 'resolved' });
    expect(res.status).toBe(403);
  });

  it('an admin can change incident status', async () => {
    const res = await request(app)
      .patch(`/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect((res.body as IncidentResp).status).toBe('in_progress');
  });

  it('rejects a stale update with a conflict when expectedUpdatedAt is outdated', async () => {
    const res = await request(app)
      .patch(`/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved', expectedUpdatedAt: new Date(0).toISOString() });
    expect(res.status).toBe(409);
    expect((res.body as { error: string }).error).toBe('conflict');
  });

  it('rejects an incident with an unknown category', async () => {
    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ mauvaise catégorie',
        category: 'categorie-inexistante',
      });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe('invalid_category');
  });

  it('incident categories are admin-managed', async () => {
    const forbidden = await request(app)
      .post('/admin/incident-categories')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({ label: 'Interdit' });
    expect(forbidden.status).toBe(403);

    const created = await request(app)
      .post('/admin/incident-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: `Nuisance ${STAMP}` });
    expect(created.status).toBe(201);
    const cat = created.body as { id: string; slug: string };

    const list = await request(app)
      .get('/incident-categories')
      .set('Authorization', `Bearer ${residentToken}`);
    expect((list.body as { items: Array<{ slug: string }> }).items.some((c) => c.slug === cat.slug)).toBe(
      true,
    );

    const del = await request(app)
      .delete(`/admin/incident-categories/${cat.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
  });
});
