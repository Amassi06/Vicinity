/**
 * Tests E2E upload de pièce jointe de message (photo/vocal).
 * Requiert Postgres (`make up`).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import { MessageModel } from '../src/db/mongo/models/message.model';
import { ensureTestNeighbourhood } from './helpers';

const TIMEOUT_MS = 30_000;
const STAMP = Date.now();
const USER = `__msg_attach_user_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';
const CONVERSATION_ID = `__test_conv_${STAMP}`;

interface AuthBody {
  accessToken: string;
  user: { id: string; email: string };
}

describe('Message attachments upload', () => {
  const app = createApp();
  let userId = '';
  let token = '';

  beforeAll(async () => {
    await Promise.all([prisma.$connect(), connectMongo()]);
    const signup = await request(app)
      .post('/auth/signup')
      .send({ email: USER, password: PASSWORD, displayName: USER, neighbourhoodId: await ensureTestNeighbourhood() });
    const body = signup.body as AuthBody;
    userId = body.user.id;
    token = body.accessToken;
  }, TIMEOUT_MS);

  afterAll(async () => {
    await MessageModel.deleteMany({ conversationId: CONVERSATION_ID });
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await Promise.all([prisma.$disconnect(), disconnectMongo()]);
  }, TIMEOUT_MS);

  it('rejects an upload without a file', async () => {
    const res = await request(app)
      .post(`/conversations/${CONVERSATION_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'image');
    expect(res.status).toBe(400);
    const body = res.body as { error: string; message?: string };
    expect(body.error).toBe('missing_file');
    expect(body.message).toBe('No file provided.');
  });

  it('translates the same error to French via Accept-Language', async () => {
    const res = await request(app)
      .post(`/conversations/${CONVERSATION_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-Language', 'fr-FR')
      .field('kind', 'image');
    expect(res.status).toBe(400);
    expect((res.body as { message?: string }).message).toBe('Aucun fichier fourni.');
  });

  it('uploads an image attachment and returns a storage key usable in a message', async () => {
    const res = await request(app)
      .post(`/conversations/${CONVERSATION_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'image')
      .attach('file', Buffer.from('fake-image-bytes'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });
    expect(res.status).toBe(201);
    const body = res.body as { storageKey: string; contentType: string; size: number; kind: string };
    expect(body.kind).toBe('image');
    expect(body.contentType).toBe('image/jpeg');
    expect(body.storageKey).toEqual(expect.any(String));
    expect(body.size).toBeGreaterThan(0);

    const message = await request(app)
      .post(`/conversations/${CONVERSATION_ID}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '', attachments: [body] });
    expect(message.status).toBe(201);
    const created = message.body as { attachments: Array<{ storageKey: string }> };
    expect(created.attachments[0]?.storageKey).toBe(body.storageKey);
  });

  it('rejects an unknown attachment kind', async () => {
    const res = await request(app)
      .post(`/conversations/${CONVERSATION_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'not_a_kind')
      .attach('file', Buffer.from('bytes'), { filename: 'x.bin', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });
});
