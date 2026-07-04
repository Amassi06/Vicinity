/**
 * Tests E2E événements : validation temporelle, permissions de suppression,
 * vue des intéressés (amis) et archivage automatique.
 * Requiert Postgres + Mongo + Neo4j (`make up`).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import { EventModel } from '../src/db/mongo/models';
import { archivePastEvents } from '../src/events/service';
import { ensureTestNeighbourhood } from './helpers';

const TIMEOUT_MS = 30_000;
const STAMP = Date.now();
const ORGANIZER = `__evt_org_${STAMP}@example.com`;
const OTHER = `__evt_other_${STAMP}@example.com`;
const ADMIN = `__evt_admin_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';
let NH = '';

interface AuthBody {
  accessToken: string;
  user: { id: string };
}

async function signup(app: ReturnType<typeof createApp>, email: string): Promise<AuthBody> {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: PASSWORD, displayName: email, neighbourhoodId: NH });
  return res.body as AuthBody;
}

function future(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 3600 * 1000).toISOString();
}

describe('Events — dates, delete perms, archive', () => {
  const app = createApp();
  let orgId = '';
  let orgToken = '';
  let otherToken = '';
  let adminToken = '';
  const created: string[] = [];

  beforeAll(async () => {
    await Promise.all([prisma.$connect(), connectMongo()]);
    NH = await ensureTestNeighbourhood();
    const org = await signup(app, ORGANIZER);
    const other = await signup(app, OTHER);
    const admin = await signup(app, ADMIN);
    orgId = org.user.id;
    orgToken = org.accessToken;
    otherToken = other.accessToken;
    await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
    const login = await request(app).post('/auth/login').send({ email: ADMIN, password: PASSWORD });
    adminToken = (login.body as AuthBody).accessToken;
  }, TIMEOUT_MS);

  afterAll(async () => {
    await EventModel.deleteMany({ organizerId: { $in: [orgId] } });
    const users = await prisma.user.findMany({
      where: { email: { in: [ORGANIZER, OTHER, ADMIN] } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await Promise.all([prisma.$disconnect(), disconnectMongo()]);
  }, TIMEOUT_MS);

  it('rejects an event that starts in the past', async () => {
    const res = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({
        neighbourhoodId: NH,
        title: '__test__ passé',
        startsAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        endsAt: future(2),
      });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe('event_in_past');
  });

  it('creates a future event and publishes it', async () => {
    const res = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ neighbourhoodId: NH, title: '__test__ futur', startsAt: future(2), endsAt: future(4) });
    expect(res.status).toBe(201);
    const id = (res.body as { _id: string })._id;
    created.push(id);
    const pub = await request(app)
      .post(`/events/${id}/publish`)
      .set('Authorization', `Bearer ${orgToken}`);
    expect(pub.status).toBe(200);
  });

  it('only the organizer or an admin can delete', async () => {
    const id = created[0]!;
    const forbidden = await request(app)
      .delete(`/events/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(app).delete(`/events/${id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(204);
    expect(await EventModel.findById(id).lean()).toBeNull();
  });

  it('interested view: admin sees the full list, resident sees friends only', async () => {
    const create = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ neighbourhoodId: NH, title: '__test__ intérêts', startsAt: future(2), endsAt: future(3) });
    const id = (create.body as { _id: string })._id;
    created.push(id);
    await request(app).post(`/events/${id}/publish`).set('Authorization', `Bearer ${orgToken}`);
    await request(app).post(`/events/${id}/interest`).set('Authorization', `Bearer ${otherToken}`);

    const adminView = await request(app)
      .get(`/events/${id}/interested`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminView.status).toBe(200);
    expect((adminView.body as { role: string; total: number }).role).toBe('admin');
    expect((adminView.body as { total: number }).total).toBe(1);

    const resView = await request(app)
      .get(`/events/${id}/interested`)
      .set('Authorization', `Bearer ${orgToken}`);
    expect((resView.body as { role: string }).role).toBe('habitant');
    // pas ami ⇒ pas de noms exposés, mais le total reste visible
    expect(Array.isArray((resView.body as { friendsInterested: unknown[] }).friendsInterested)).toBe(true);
  });

  it('archivePastEvents archives published events ended more than 1h ago', async () => {
    const doc = await EventModel.create({
      title: '__test__ archive',
      organizerId: orgId,
      neighbourhoodId: NH,
      startsAt: new Date(Date.now() - 3 * 3600 * 1000),
      endsAt: new Date(Date.now() - 2 * 3600 * 1000),
      status: 'published',
    });
    created.push(String(doc._id));

    const n = await archivePastEvents();
    expect(n).toBeGreaterThanOrEqual(1);
    const refreshed = await EventModel.findById(doc._id).lean();
    expect(refreshed?.status).toBe('archived');
    expect(refreshed?.archivedAt).toBeTruthy();
  });
});
