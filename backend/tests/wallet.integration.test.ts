/**
 * Tests E2E wallet — transfert atomique de points + endpoint /me/wallet.
 * Requiert Postgres (`make up`).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { creditPoints, transferPoints, getWallet } from '../src/wallet/service';

const TIMEOUT_MS = 20_000;
const STAMP = Date.now();
const ALICE = `__wallet_alice_${STAMP}@example.com`;
const BOB = `__wallet_bob_${STAMP}@example.com`;
const ADMIN = `__wallet_admin_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';

interface AuthBody {
  accessToken: string;
  user: { id: string; email: string; role: string };
}

async function signup(app: ReturnType<typeof createApp>, email: string) {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: PASSWORD, displayName: email });
  return res.body as AuthBody;
}

describe('Wallet — points & transactions', () => {
  const app = createApp();
  let aliceId = '';
  let bobId = '';
  let adminId = '';
  let adminToken = '';

  beforeAll(async () => {
    await prisma.$connect();
    const alice = await signup(app, ALICE);
    const bob = await signup(app, BOB);
    const admin = await signup(app, ADMIN);
    aliceId = alice.user.id;
    bobId = bob.user.id;
    adminId = admin.user.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
    const login = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN, password: PASSWORD });
    adminToken = (login.body as AuthBody).accessToken;
  }, TIMEOUT_MS);

  afterAll(async () => {
    const ids = [aliceId, bobId, adminId].filter(Boolean);
    if (ids.length) {
      await prisma.pointTransaction.deleteMany({
        where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] },
      });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  }, TIMEOUT_MS);

  it('credits points (no debit) and updates balance', async () => {
    await creditPoints({
      toUserId: aliceId,
      amount: 100,
      reason: 'WELCOME_BONUS',
    });
    const w = await getWallet(aliceId);
    expect(w.balance).toBe(100);
    expect(w.recent[0]).toMatchObject({ direction: 'CREDIT', amount: 100 });
  });

  it('transfers points atomically between two users', async () => {
    await transferPoints({
      fromUserId: aliceId,
      toUserId: bobId,
      amount: 30,
      reason: 'SERVICE_PAYMENT',
    });
    const [alice, bob] = await Promise.all([getWallet(aliceId), getWallet(bobId)]);
    expect(alice.balance).toBe(70);
    expect(bob.balance).toBe(30);
  });

  it('rejects transfer when funds are insufficient (no partial state)', async () => {
    await expect(
      transferPoints({
        fromUserId: aliceId,
        toUserId: bobId,
        amount: 9_999,
        reason: 'SERVICE_PAYMENT',
      }),
    ).rejects.toThrow('insufficient_funds');
    const [alice, bob] = await Promise.all([getWallet(aliceId), getWallet(bobId)]);
    expect(alice.balance).toBe(70);
    expect(bob.balance).toBe(30);
  });

  it('GET /me/wallet returns balance + recent transactions', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: ALICE, password: PASSWORD });
    const token = (login.body as AuthBody).accessToken;
    const res = await request(app).get('/me/wallet').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body as { balance: number; recent: unknown[] };
    expect(body.balance).toBe(70);
    expect(Array.isArray(body.recent)).toBe(true);
    expect(body.recent.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /admin/wallet/credit is admin-only', async () => {
    const userLogin = await request(app)
      .post('/auth/login')
      .send({ email: ALICE, password: PASSWORD });
    const userToken = (userLogin.body as AuthBody).accessToken;
    const forbidden = await request(app)
      .post('/admin/wallet/credit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ toUserId: bobId, amount: 10, reason: 'ADMIN_ADJUSTMENT' });
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .post('/admin/wallet/credit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toUserId: bobId, amount: 10, reason: 'ADMIN_ADJUSTMENT' });
    expect(ok.status).toBe(204);
    const bob = await getWallet(bobId);
    expect(bob.balance).toBe(40);
  });
});
