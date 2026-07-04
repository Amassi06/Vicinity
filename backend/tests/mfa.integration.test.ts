/**
 * Test E2E MFA TOTP + SSO — requiert Postgres (`make up`).
 */
import request from 'supertest';
import { authenticator } from 'otplib';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { ensureTestNeighbourhood } from './helpers';

const TIMEOUT_MS = 20_000;
const EMAIL = `__test__mfa_${Date.now()}@example.com`;
const PASSWORD = 'sup3rstrongpass';

interface AuthBody {
  accessToken: string;
  user: { id: string };
}
interface EnrollBody {
  secret: string;
  otpauthUri: string;
}

describe('MFA TOTP + SSO', () => {
  const app = createApp();
  let userId = '';
  let accessToken = '';

  beforeAll(async () => {
    await prisma.$connect();
    const signup = await request(app)
      .post('/auth/signup')
      .send({ email: EMAIL, password: PASSWORD, displayName: 'MFA Test', neighbourhoodId: await ensureTestNeighbourhood() });
    const body = signup.body as AuthBody;
    accessToken = body.accessToken;
    userId = body.user.id;
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }, TIMEOUT_MS);

  it('enroll returns secret and otpauth URI', async () => {
    const res = await request(app)
      .post('/auth/mfa/enroll')
      .set('Authorization', `Bearer ${accessToken}`);
    const body = res.body as EnrollBody;
    expect(res.status).toBe(200);
    expect(body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
  });

  it('activate succeeds with correct token, then verify works', async () => {
    const enroll = await request(app)
      .post('/auth/mfa/enroll')
      .set('Authorization', `Bearer ${accessToken}`);
    const { secret } = enroll.body as EnrollBody;

    const goodToken = authenticator.generate(secret);
    const activate = await request(app)
      .post('/auth/mfa/activate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: goodToken });
    expect(activate.status).toBe(204);

    const verify = await request(app)
      .post('/auth/mfa/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: authenticator.generate(secret) });
    expect(verify.status).toBe(200);
    expect((verify.body as { valid: boolean }).valid).toBe(true);
  });

  it('login requires a valid MFA token once MFA is enabled', async () => {
    const enroll = await request(app)
      .post('/auth/mfa/enroll')
      .set('Authorization', `Bearer ${accessToken}`);
    const { secret } = enroll.body as EnrollBody;
    await request(app)
      .post('/auth/mfa/activate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: authenticator.generate(secret) });

    const noToken = await request(app).post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(noToken.status).toBe(401);
    expect((noToken.body as { error: string }).error).toBe('mfa_required');

    const wrongToken = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD, mfaToken: '000000' });
    expect(wrongToken.status).toBe(401);
    expect((wrongToken.body as { error: string }).error).toBe('mfa_required');

    const goodLogin = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD, mfaToken: authenticator.generate(secret) });
    expect(goodLogin.status).toBe(200);
    expect((goodLogin.body as AuthBody).user.id).toBe(userId);
  });

  it('activate fails with wrong token', async () => {
    await request(app).post('/auth/mfa/enroll').set('Authorization', `Bearer ${accessToken}`);
    const res = await request(app)
      .post('/auth/mfa/activate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: '000000' });
    expect(res.status).toBe(400);
  });

  it('sso issues an access token that the desktop can use', async () => {
    const sso = await request(app)
      .post('/auth/sso/issue')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(sso.status).toBe(200);
    const { ssoToken } = sso.body as { ssoToken: string };

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${ssoToken}`);
    expect(me.status).toBe(200);
    expect((me.body as { sub: string }).sub).toBe(userId);
  });
});
