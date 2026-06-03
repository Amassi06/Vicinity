/**
 * Tests E2E documents — upload PDF, zones, signature avec MFA obligatoire.
 * Requiert Postgres + Mongo (`make up`).
 */
import crypto from 'node:crypto';
import { authenticator } from 'otplib';
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import { DocumentModel } from '../src/db/mongo/models';

const TIMEOUT_MS = 30_000;
const STAMP = Date.now();
const OWNER = `__doc_owner_${STAMP}@example.com`;
const SIGNER = `__doc_signer_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';

// PDF minimal valide (header + EOF marker)
const FAKE_PDF = Buffer.concat([
  Buffer.from('%PDF-1.4\n'),
  Buffer.from('1 0 obj<<>>endobj\n'),
  Buffer.from('trailer<<>>\n'),
  Buffer.from('%%EOF'),
  crypto.randomBytes(64),
]);

interface AuthBody {
  accessToken: string;
  user: { id: string; email: string };
}

interface DocResp {
  _id: string;
  status: string;
  zones: Array<{ signedBy: string | null; signatureHash: string | null }>;
  sha256: string;
}

async function signup(app: ReturnType<typeof createApp>, email: string): Promise<AuthBody> {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: PASSWORD, displayName: email });
  return res.body as AuthBody;
}

async function enrollAndActivateMfa(
  app: ReturnType<typeof createApp>,
  token: string,
): Promise<string> {
  const enroll = await request(app)
    .post('/auth/mfa/enroll')
    .set('Authorization', `Bearer ${token}`);
  const secret = (enroll.body as { secret: string }).secret;
  const totp = authenticator.generate(secret);
  await request(app)
    .post('/auth/mfa/activate')
    .set('Authorization', `Bearer ${token}`)
    .send({ token: totp });
  return secret;
}

describe('Documents — upload, zones, signature MFA', () => {
  const app = createApp();
  let ownerId = '';
  let signerId = '';
  let ownerToken = '';
  let signerToken = '';
  let signerMfaSecret = '';
  let documentId = '';

  beforeAll(async () => {
    await Promise.all([prisma.$connect(), connectMongo()]);
    const owner = await signup(app, OWNER);
    const signer = await signup(app, SIGNER);
    ownerId = owner.user.id;
    signerId = signer.user.id;
    ownerToken = owner.accessToken;
    signerToken = signer.accessToken;
    signerMfaSecret = await enrollAndActivateMfa(app, signerToken);
    // Re-login signer pour obtenir un access token avec mfa=true dans le payload.
    const relogin = await request(app)
      .post('/auth/login')
      .send({ email: SIGNER, password: PASSWORD });
    signerToken = (relogin.body as AuthBody).accessToken;
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (documentId) await DocumentModel.deleteOne({ _id: documentId });
    const ids = [ownerId, signerId].filter(Boolean);
    if (ids.length) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await Promise.all([prisma.$disconnect(), disconnectMongo()]);
  }, TIMEOUT_MS);

  it('POST /documents rejects non-pdf files', async () => {
    const res = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'not a pdf')
      .attach('file', Buffer.from('plain text'), { filename: 'foo.txt', contentType: 'text/plain' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST /documents uploads a PDF and returns the document', async () => {
    const res = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', '__test__ Convention voisinage')
      .attach('file', FAKE_PDF, { filename: 'convention.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    const body = res.body as DocResp;
    expect(body.status).toBe('draft');
    expect(body.sha256).toMatch(/^[0-9a-f]{64}$/);
    documentId = body._id;
  });

  it('POST /documents/:id/zones (owner) defines signature zones and adds participants', async () => {
    const res = await request(app)
      .post(`/documents/${documentId}/zones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        zones: [
          { page: 1, x: 100, y: 200, width: 150, height: 40, required: true },
          { page: 1, x: 100, y: 260, width: 150, height: 40, required: true },
        ],
        participants: [signerId],
      });
    expect(res.status).toBe(200);
    const body = res.body as DocResp & { participants: string[] };
    expect(body.status).toBe('pending_signatures');
    expect(body.zones).toHaveLength(2);
    expect(body.participants).toEqual(expect.arrayContaining([ownerId, signerId]));
  });

  it('refuses signature without MFA (user without active mfa)', async () => {
    const res = await request(app)
      .post(`/documents/${documentId}/zones/0/sign`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ token: '000000' });
    expect(res.status).toBe(401);
    expect((res.body as { error: string }).error).toBe('mfa_required');
  });

  it('refuses signature with wrong TOTP', async () => {
    const res = await request(app)
      .post(`/documents/${documentId}/zones/0/sign`)
      .set('Authorization', `Bearer ${signerToken}`)
      .send({ token: '000000' });
    expect(res.status).toBe(401);
  });

  it('signs zone 0 with valid TOTP and produces a signature hash', async () => {
    const totp = authenticator.generate(signerMfaSecret);
    const res = await request(app)
      .post(`/documents/${documentId}/zones/0/sign`)
      .set('Authorization', `Bearer ${signerToken}`)
      .send({ token: totp });
    expect(res.status).toBe(200);
    const body = res.body as DocResp;
    expect(body.zones[0]?.signedBy).toBe(signerId);
    expect(body.zones[0]?.signatureHash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.status).toBe('pending_signatures');
  });

  it('refuses to re-sign an already signed zone', async () => {
    const totp = authenticator.generate(signerMfaSecret);
    const res = await request(app)
      .post(`/documents/${documentId}/zones/0/sign`)
      .set('Authorization', `Bearer ${signerToken}`)
      .send({ token: totp });
    expect(res.status).toBe(409);
    expect((res.body as { error: string }).error).toBe('already_signed');
  });

  it('signing all required zones moves the doc to signed', async () => {
    const totp = authenticator.generate(signerMfaSecret);
    const res = await request(app)
      .post(`/documents/${documentId}/zones/1/sign`)
      .set('Authorization', `Bearer ${signerToken}`)
      .send({ token: totp });
    expect(res.status).toBe(200);
    expect((res.body as DocResp).status).toBe('signed');

    const audit = await prisma.auditLog.findMany({
      where: { userId: signerId, action: 'SIGN_DOCUMENT' },
    });
    expect(audit.length).toBe(2);
  });

  it('GET /documents/:id/file streams the original bytes (sha256 match)', async () => {
    const res = await request(app)
      .get(`/documents/${documentId}/file`)
      .set('Authorization', `Bearer ${signerToken}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    const downloaded = res.body as Buffer;
    const sha256 = crypto.createHash('sha256').update(downloaded).digest('hex');
    const expected = crypto.createHash('sha256').update(FAKE_PDF).digest('hex');
    expect(sha256).toBe(expected);
  });

  it('refuses access to non-participants', async () => {
    const other = await signup(app, `__doc_outsider_${STAMP}@example.com`);
    const res = await request(app)
      .get(`/documents/${documentId}`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    expect(res.status).toBe(403);
    await prisma.session.deleteMany({ where: { userId: other.user.id } });
    await prisma.user.delete({ where: { id: other.user.id } });
  });
});
