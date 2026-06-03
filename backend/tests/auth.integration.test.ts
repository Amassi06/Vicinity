/**
 * Test E2E flux auth — requiert Postgres (`make up`).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';

const TIMEOUT_MS = 20_000;
const EMAIL = `__test__${Date.now()}@example.com`;
const PASSWORD = 'sup3rstrongpass';

interface AuthBody {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

describe('Auth flow', () => {
  const app = createApp();
  let userId = '';
  let refreshToken = '';

  beforeAll(async () => {
    await prisma.$connect();
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }, TIMEOUT_MS);

  it('signup creates user and returns tokens', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: EMAIL, password: PASSWORD, displayName: 'Test User' });
    const body = res.body as AuthBody;

    expect(res.status).toBe(201);
    expect(body.user.email).toBe(EMAIL);
    expect(body.user.role).toBe('HABITANT');
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();

    userId = body.user.id;
    refreshToken = body.refreshToken;
  });

  it('login with right credentials returns tokens', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect((res.body as AuthBody).accessToken).toBeDefined();
  });

  it('login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('me returns the access payload', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    const token = (login.body as AuthBody).accessToken;
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect((me.body as { email: string }).email).toBe(EMAIL);
  });

  it('admin-only is forbidden for habitant', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    const token = (login.body as AuthBody).accessToken;
    const r = await request(app).get('/auth/admin-only').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
  });

  it('refresh rotates tokens and revokes the previous one', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    const body = res.body as { accessToken: string; refreshToken: string };
    expect(body.refreshToken).not.toBe(refreshToken);

    const reuse = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
    refreshToken = body.refreshToken;
  });

  it('logout revokes the current session', async () => {
    const logout = await request(app).post('/auth/logout').send({ refreshToken });
    expect(logout.status).toBe(204);
    const r = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(r.status).toBe(401);
  });
});
