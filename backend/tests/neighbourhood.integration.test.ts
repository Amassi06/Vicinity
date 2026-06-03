/**
 * Test E2E CRUD quartiers + PostGIS — requiert Postgres (`make up`).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';

const TIMEOUT_MS = 20_000;

interface AuthBody {
  accessToken: string;
  user: { id: string };
}

interface Neighbourhood {
  id: string;
  name: string;
  description: string | null;
  boundary: { type: string; coordinates: number[][][] };
}

const SQUARE = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [2.34, 48.85],
      [2.36, 48.85],
      [2.36, 48.87],
      [2.34, 48.87],
      [2.34, 48.85],
    ],
  ],
};

async function makeAdmin(app: ReturnType<typeof createApp>, email: string): Promise<string> {
  const signup = await request(app)
    .post('/auth/signup')
    .send({ email, password: 'sup3rstrongpass', displayName: 'Admin' });
  const { user, accessToken } = signup.body as AuthBody;
  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  const relogin = await request(app)
    .post('/auth/login')
    .send({ email, password: 'sup3rstrongpass' });
  return (relogin.body as AuthBody).accessToken ?? accessToken;
}

describe('Neighbourhoods CRUD', () => {
  const app = createApp();
  let adminToken = '';
  let userToken = '';
  let adminId = '';
  let userId = '';
  let createdId = '';

  beforeAll(async () => {
    await prisma.$connect();
    adminToken = await makeAdmin(app, `__test__admin_${Date.now()}@example.com`);
    const habitant = await request(app).post('/auth/signup').send({
      email: `__test__user_${Date.now()}@example.com`,
      password: 'sup3rstrongpass',
      displayName: 'Habitant',
    });
    const habitantBody = habitant.body as AuthBody;
    userToken = habitantBody.accessToken;
    userId = habitantBody.user.id;

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    adminId = admins[0]?.id ?? '';
  }, TIMEOUT_MS);

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM neighbourhoods WHERE name LIKE '__test__%'`,
    );
    await prisma.session.deleteMany({ where: { userId: { in: [adminId, userId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, userId] } } });
    await prisma.$disconnect();
  }, TIMEOUT_MS);

  it('habitant cannot create a neighbourhood', async () => {
    const res = await request(app)
      .post('/neighbourhoods')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: '__test__refused', boundary: SQUARE });
    expect(res.status).toBe(403);
  });

  it('admin creates a neighbourhood and PostGIS stores the polygon', async () => {
    const res = await request(app)
      .post('/neighbourhoods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `__test__zone_${Date.now()}`, description: 'centre', boundary: SQUARE });
    expect(res.status).toBe(201);
    const body = res.body as Neighbourhood;
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.boundary.type).toBe('Polygon');
    expect(body.boundary.coordinates[0]?.length).toBe(5);
    createdId = body.id;
  });

  it('list and get return the newly created neighbourhood', async () => {
    const list = await request(app)
      .get('/neighbourhoods')
      .set('Authorization', `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect((list.body as Neighbourhood[]).some((n) => n.id === createdId)).toBe(true);

    const single = await request(app)
      .get(`/neighbourhoods/${createdId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(single.status).toBe(200);
    expect((single.body as Neighbourhood).id).toBe(createdId);
  });

  it('patch updates name and description', async () => {
    const res = await request(app)
      .patch(`/neighbourhoods/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'updated' });
    expect(res.status).toBe(200);
    expect((res.body as Neighbourhood).description).toBe('updated');
  });

  it('delete removes the neighbourhood', async () => {
    const del = await request(app)
      .delete(`/neighbourhoods/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
    const after = await request(app)
      .get(`/neighbourhoods/${createdId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(after.status).toBe(404);
  });

  it('rejects an open polygon (ring not closed)', async () => {
    const res = await request(app)
      .post('/neighbourhoods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '__test__broken',
        boundary: {
          type: 'Polygon',
          coordinates: [
            [
              [2.0, 48.0],
              [2.1, 48.0],
              [2.1, 48.1],
              [2.0, 48.1],
            ],
          ],
        },
      });
    expect(res.status).toBe(400);
  });
});
