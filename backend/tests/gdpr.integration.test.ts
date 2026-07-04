import request from 'supertest';
import { authenticator } from 'otplib';
import { createApp } from '../src/http/app.js';
import { prisma } from '../src/db/prisma.js';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection.js';
import { ensureTestNeighbourhood } from './helpers';

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
      .send({ email: EMAIL, password: 'password12345', displayName: 'GDPR Test', neighbourhoodId: await ensureTestNeighbourhood() });
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

  it('PATCH /me/profile updates the display name freely', async () => {
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName: 'GDPR Renamed' });
    expect(res.status).toBe(200);
    expect((res.body as { user: { displayName: string } }).user.displayName).toBe('GDPR Renamed');
  });

  it('PATCH /me/profile allows an email change without MFA when the user never enabled it', async () => {
    // Régression : sans ce comportement, un utilisateur qui n'a jamais activé le MFA
    // ne pourrait plus jamais changer son e-mail (verifyMfaForUser renvoie toujours
    // false pour un compte mfaEnabled=false, donc aucun token ne serait valide).
    const newEmail = `__gdpr_new__${Date.now()}@example.com`;
    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: newEmail });
    expect(res.status).toBe(200);
    expect((res.body as { user: { email: string } }).user.email).toBe(newEmail);
  });

  it('PATCH /me/profile requires a valid MFA token once MFA is enabled', async () => {
    const enroll = await request(app)
      .post('/auth/mfa/enroll')
      .set('Authorization', `Bearer ${accessToken}`);
    const { secret } = enroll.body as { secret: string };
    await request(app)
      .post('/auth/mfa/activate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: authenticator.generate(secret) });

    const noToken = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: `__gdpr_mfa_new__${Date.now()}@example.com` });
    expect(noToken.status).toBe(401);
    expect((noToken.body as { error: string }).error).toBe('mfa_required');

    const wrongToken = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: `__gdpr_mfa_new__${Date.now()}@example.com`, mfaToken: '000000' });
    expect(wrongToken.status).toBe(401);
    expect((wrongToken.body as { error: string }).error).toBe('mfa_required');

    const goodEmail = `__gdpr_mfa_new__${Date.now()}@example.com`;
    const goodToken = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: goodEmail, mfaToken: authenticator.generate(secret) });
    expect(goodToken.status).toBe(200);
    expect((goodToken.body as { user: { email: string } }).user.email).toBe(goodEmail);
  });
});
