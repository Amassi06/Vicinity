import request from 'supertest';
import { createApp } from '../src/http/app.js';
import { prisma } from '../src/db/prisma.js';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection.js';

const TIMEOUT_MS = 25_000;
const EMAIL = `__gdpr__${Date.now()}@example.com`;

describe('RGPD routes', () => {
  const app = createApp();
  let accessToken = '';
  let userId = '';

  beforeAll(async () => {
    await prisma.$connect();
    await connectMongo();
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (userId) {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await disconnectMongo();
    await prisma.$disconnect();
  }, TIMEOUT_MS);

  it('signup then export and patch consents', async () => {
    const signup = await request(app)
      .post('/auth/signup')
      .send({ email: EMAIL, password: 'password12345', displayName: 'GDPR Test' });
    expect(signup.status).toBe(201);
    const body = signup.body as { accessToken: string; user: { id: string } };
    accessToken = body.accessToken;
    userId = body.user.id;

    const consents = await request(app)
      .patch('/me/consents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ marketing: true });
    expect(consents.status).toBe(200);

    const exported = await request(app)
      .get('/me/export')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(exported.status).toBe(200);
    expect(exported.body.user.email).toBe(EMAIL);
  });
});
