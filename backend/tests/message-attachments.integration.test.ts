/**
 * Tests E2E upload de pièce jointe de message (photo/vocal), redimensionnement
 * des images à 200×200, et autorisation par conversation.
 * Requiert Postgres + Mongo (`make up`).
 */
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import { MessageModel } from '../src/db/mongo/models/message.model';
import { ensureTestNeighbourhood, TEST_NEIGHBOURHOOD_ID } from './helpers';

const TIMEOUT_MS = 30_000;
const STAMP = Date.now();
const USER = `__msg_attach_user_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';
// Salon public du quartier de test : le compte y a accès (même quartier).
const CONVERSATION_ID = `nbh:${TEST_NEIGHBOURHOOD_ID}`;

interface AuthBody {
  accessToken: string;
  user: { id: string; email: string };
}

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
    .png()
    .toBuffer();
}

describe('Message attachments upload', () => {
  const app = createApp();
  let userId = '';
  let token = '';

  beforeAll(async () => {
    await Promise.all([prisma.$connect(), connectMongo()]);
    const signup = await request(app)
      .post('/auth/signup')
      .send({
        email: USER,
        password: PASSWORD,
        displayName: USER,
        neighbourhoodId: await ensureTestNeighbourhood(),
      });
    const body = signup.body as AuthBody;
    userId = body.user.id;
    token = body.accessToken;
  }, TIMEOUT_MS);

  afterAll(async () => {
    await MessageModel.deleteMany({ senderId: userId });
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

  it('resizes an image to 200x200 (PNG) and lets it be used in a message', async () => {
    const big = await makePng(500, 400);
    const res = await request(app)
      .post(`/conversations/${CONVERSATION_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'image')
      .attach('file', big, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const body = res.body as { storageKey: string; contentType: string; size: number; kind: string };
    expect(body.kind).toBe('image');
    expect(body.contentType).toBe('image/png');

    // Récupère la pièce jointe et vérifie qu'elle tient dans 200×200.
    const message = await request(app)
      .post(`/conversations/${CONVERSATION_ID}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '', attachments: [body] });
    expect(message.status).toBe(201);

    const download = await request(app)
      .get(`/conversations/${CONVERSATION_ID}/attachments/${body.storageKey}`)
      .set('Authorization', `Bearer ${token}`);
    expect(download.status).toBe(200);
    const meta = await sharp(download.body as Buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(200);
    expect(meta.height).toBeLessThanOrEqual(200);
    // ratio préservé (500×400 -> 200×160)
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(160);
  }, TIMEOUT_MS);

  it('rejects an unknown attachment kind', async () => {
    const res = await request(app)
      .post(`/conversations/${CONVERSATION_ID}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'not_a_kind')
      .attach('file', Buffer.from('bytes'), {
        filename: 'x.bin',
        contentType: 'application/octet-stream',
      });
    expect(res.status).toBe(400);
  });

  it('forbids uploading to a conversation the user is not part of', async () => {
    const res = await request(app)
      .post('/conversations/dm:11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222/attachments')
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'image')
      .attach('file', await makePng(10, 10), { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });
});
