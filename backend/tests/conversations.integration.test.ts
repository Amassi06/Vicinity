/**
 * Tests E2E messagerie : conversations à ids déterministes (salon public + DM),
 * autorisation d'accès, non-lus et marquage comme lu.
 * Requiert Postgres + Mongo (`make up`).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import { MessageModel } from '../src/db/mongo/models/message.model';
import { ensureTestNeighbourhood, TEST_NEIGHBOURHOOD_ID } from './helpers';

const TIMEOUT_MS = 30_000;
const STAMP = Date.now();
const ALICE = `__conv_alice_${STAMP}@example.com`;
const BOB = `__conv_bob_${STAMP}@example.com`;
const OUTSIDER = `__conv_out_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';

interface AuthBody {
  accessToken: string;
  user: { id: string };
}

async function signup(app: ReturnType<typeof createApp>, email: string, nid: string): Promise<AuthBody> {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: PASSWORD, displayName: email, neighbourhoodId: nid });
  return res.body as AuthBody;
}

function dmId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(':')}`;
}

describe('Conversations — public room, DM, authorization, unread', () => {
  const app = createApp();
  let aliceId = '';
  let bobId = '';
  let aliceToken = '';
  let bobToken = '';
  let outsiderToken = '';
  let otherNeighbourhoodId = '';
  const publicRoom = `nbh:${TEST_NEIGHBOURHOOD_ID}`;

  beforeAll(async () => {
    await Promise.all([prisma.$connect(), connectMongo()]);
    const nid = await ensureTestNeighbourhood();
    // Un second quartier pour l'outsider.
    otherNeighbourhoodId = '00000000-0000-4000-8000-00000000beef';
    await prisma.$executeRawUnsafe(
      `INSERT INTO neighbourhoods (id, name, boundary, updated_at)
       VALUES ('${otherNeighbourhoodId}'::uuid, '__test__other_nbh',
         ST_GeomFromText('POLYGON((2.4 48.85, 2.42 48.85, 2.42 48.86, 2.4 48.86, 2.4 48.85))', 4326), NOW())
       ON CONFLICT (id) DO NOTHING;`,
    );
    const alice = await signup(app, ALICE, nid);
    const bob = await signup(app, BOB, nid);
    const outsider = await signup(app, OUTSIDER, otherNeighbourhoodId);
    aliceId = alice.user.id;
    bobId = bob.user.id;
    aliceToken = alice.accessToken;
    bobToken = bob.accessToken;
    outsiderToken = outsider.accessToken;
  }, TIMEOUT_MS);

  afterAll(async () => {
    await MessageModel.deleteMany({ senderId: { $in: [aliceId, bobId] } });
    const users = await prisma.user.findMany({
      where: { email: { in: [ALICE, BOB, OUTSIDER] } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await Promise.all([prisma.$disconnect(), disconnectMongo()]);
  }, TIMEOUT_MS);

  it('a resident can post and read the neighbourhood public room', async () => {
    const post = await request(app)
      .post(`/conversations/${publicRoom}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ body: 'Bonjour le quartier' });
    expect(post.status).toBe(201);

    const list = await request(app)
      .get(`/conversations/${publicRoom}/messages`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(list.status).toBe(200);
    expect((list.body as { items: unknown[] }).items.length).toBeGreaterThanOrEqual(1);
  });

  it('an outsider (other neighbourhood) is forbidden from the public room', async () => {
    const res = await request(app)
      .get(`/conversations/${publicRoom}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects an empty message', async () => {
    const res = await request(app)
      .post(`/conversations/${publicRoom}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ body: '' });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe('empty_message');
  });

  it('a DM is only accessible to its two members', async () => {
    const dm = dmId(aliceId, bobId);
    const post = await request(app)
      .post(`/conversations/${dm}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ body: 'Salut Bob' });
    expect(post.status).toBe(201);

    const bobReads = await request(app)
      .get(`/conversations/${dm}/messages`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobReads.status).toBe(200);

    const outsiderReads = await request(app)
      .get(`/conversations/${dm}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(outsiderReads.status).toBe(403);
  });

  it('unread counter reflects DM messages then clears after read', async () => {
    // Alice a écrit à Bob dans le test précédent : Bob a 1 non-lu.
    const before = await request(app)
      .get('/me/notifications')
      .set('Authorization', `Bearer ${bobToken}`);
    expect((before.body as { messages: number }).messages).toBeGreaterThanOrEqual(1);

    const dm = dmId(aliceId, bobId);
    const read = await request(app)
      .post(`/conversations/${dm}/read`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(read.status).toBe(204);

    const after = await request(app)
      .get('/me/notifications')
      .set('Authorization', `Bearer ${bobToken}`);
    // le DM est lu ; il peut rester des non-lus du salon public, mais pas de ce DM
    expect((after.body as { messages: number }).messages).toBeLessThan(
      (before.body as { messages: number }).messages,
    );
  });

  it('lists neighbours of the same neighbourhood (excluding self and admins)', async () => {
    const res = await request(app).get('/me/neighbours').set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    const ids = (res.body as { items: Array<{ id: string }> }).items.map((n) => n.id);
    expect(ids).toContain(bobId);
    expect(ids).not.toContain(aliceId);
  });
});
