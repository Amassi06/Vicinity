/**
 * Tests E2E annonces + contrats (workflow signatures + séquestre).
 * Requiert Postgres + Mongo (`make up`).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import { ContractModel, ListingModel } from '../src/db/mongo/models';
import { creditPoints } from '../src/wallet/service';
import { ensureTestNeighbourhood } from './helpers';

const TIMEOUT_MS = 30_000;
const STAMP = Date.now();
const AUTHOR = `__listing_author_${STAMP}@example.com`;
const ACCEPTOR = `__listing_buyer_${STAMP}@example.com`;
const ADMIN = `__listing_admin_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';
const CATEGORY_SLUG = `__test-cat-${STAMP}`;
let NEIGHBOURHOOD_ID = '';

interface AuthBody {
  accessToken: string;
  user: { id: string };
}

interface ListingResp {
  _id: string;
  status: string;
  contractId: string | null;
  authorId: string;
  location?: string;
}

interface ContractResp {
  _id: string;
  status: string;
  pricePoints: number;
  payerId: string;
  payeeId: string;
  payerSignedAt?: string | null;
  payeeSignedAt?: string | null;
}

interface AcceptResp {
  listing: ListingResp;
  contract: ContractResp;
}

async function signup(app: ReturnType<typeof createApp>, email: string): Promise<AuthBody> {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: PASSWORD, displayName: email, neighbourhoodId: NEIGHBOURHOOD_ID });
  return res.body as AuthBody;
}

async function balanceOf(userId: string): Promise<number> {
  const row = await prisma.user.findUnique({ where: { id: userId } });
  return row?.pointsBalance ?? -1;
}

describe('Listings — catégories, séquestre, contrats', () => {
  const app = createApp();
  let authorId = '';
  let acceptorId = '';
  let authorToken = '';
  let acceptorToken = '';
  let adminToken = '';
  const createdListings: string[] = [];

  beforeAll(async () => {
    await Promise.all([prisma.$connect(), connectMongo()]);
    NEIGHBOURHOOD_ID = await ensureTestNeighbourhood();
    await prisma.listingCategory.upsert({
      where: { slug: CATEGORY_SLUG },
      update: {},
      create: { slug: CATEGORY_SLUG, label: 'Catégorie de test' },
    });
    const author = await signup(app, AUTHOR);
    const acceptor = await signup(app, ACCEPTOR);
    const admin = await signup(app, ADMIN);
    authorId = author.user.id;
    acceptorId = acceptor.user.id;
    authorToken = author.accessToken;
    acceptorToken = acceptor.accessToken;
    await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });
    const adminLogin = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN, password: PASSWORD });
    adminToken = (adminLogin.body as AuthBody).accessToken;
    // Solde de départ : 100 (bonus) chacun ; l'acceptant reçoit 50 de plus.
    await creditPoints({ toUserId: acceptorId, amount: 50, reason: 'ADMIN_ADJUSTMENT' });
  }, TIMEOUT_MS);

  afterAll(async () => {
    const ids = [authorId, acceptorId].filter(Boolean);
    await ListingModel.deleteMany({ authorId: { $in: ids } });
    await ContractModel.deleteMany({ authorId: { $in: ids } });
    await prisma.listingCategory.deleteMany({ where: { slug: CATEGORY_SLUG } });
    const users = await prisma.user.findMany({
      where: { email: { in: [AUTHOR, ACCEPTOR, ADMIN] } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.pointTransaction.deleteMany({
      where: { OR: [{ fromUserId: { in: userIds } }, { toUserId: { in: userIds } }] },
    });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await Promise.all([prisma.$disconnect(), disconnectMongo()]);
  }, TIMEOUT_MS);

  it('create rejects an unknown category', async () => {
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ cat inconnue',
        kind: 'offer',
        category: 'categorie-inexistante',
        pricePoints: 10,
      });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe('invalid_category');
  });

  it('create rejects a paid request when the author cannot afford it', async () => {
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ demande trop chère',
        kind: 'request',
        category: CATEGORY_SLUG,
        pricePoints: 9_999,
      });
    expect(res.status).toBe(402);
    expect((res.body as { error: string }).error).toBe('insufficient_funds');
  });

  it('creates an offer with location and price', async () => {
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ cours de guitare',
        description: 'Une heure de cours',
        kind: 'offer',
        category: CATEGORY_SLUG,
        location: 'Place du marché',
        pricePoints: 10,
      });
    expect(res.status).toBe(201);
    const body = res.body as ListingResp;
    expect(body.status).toBe('open');
    expect(body.location).toBe('Place du marché');
    createdListings.push(body._id);
  });

  it('accept rejects when the payer cannot afford the price', async () => {
    const create = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ trop cher',
        kind: 'offer',
        category: CATEGORY_SLUG,
        pricePoints: 9_999,
      });
    const listing = create.body as ListingResp;
    createdListings.push(listing._id);

    const res = await request(app)
      .post(`/listings/${listing._id}/accept`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    expect(res.status).toBe(402);

    const refreshed = await ListingModel.findById(listing._id).lean();
    expect(refreshed?.status).toBe('open');
    expect(refreshed?.contractId).toBeNull();
  });

  it('accept creates a pending_signatures contract without moving points', async () => {
    const listingId = createdListings[0]!;
    const before = await balanceOf(acceptorId);

    const res = await request(app)
      .post(`/listings/${listingId}/accept`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    expect(res.status).toBe(201);
    const body = res.body as AcceptResp;
    expect(body.contract.status).toBe('pending_signatures');
    expect(body.contract.payerId).toBe(acceptorId);
    expect(body.contract.payeeId).toBe(authorId);
    expect(body.listing.status).toBe('in_progress');

    expect(await balanceOf(acceptorId)).toBe(before);
  });

  it('cannot accept the same listing twice', async () => {
    const res = await request(app)
      .post(`/listings/${createdListings[0]}/accept`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    expect(res.status).toBe(409);
  });

  it('both signatures move the price into escrow', async () => {
    const listing = await ListingModel.findById(createdListings[0]).lean();
    const contractId = String(listing?.contractId);
    const payerBefore = await balanceOf(acceptorId);

    const first = await request(app)
      .post(`/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(first.status).toBe(200);
    expect((first.body as ContractResp).status).toBe('pending_signatures');
    // pas de double signature
    const dup = await request(app)
      .post(`/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(dup.status).toBe(409);

    const second = await request(app)
      .post(`/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    expect(second.status).toBe(200);
    expect((second.body as ContractResp).status).toBe('escrowed');

    // payeur débité, prestataire PAS encore crédité
    expect(await balanceOf(acceptorId)).toBe(payerBefore - 10);
    const escrowTx = await prisma.pointTransaction.findFirst({
      where: { contractId, reason: 'ESCROW_DEPOSIT' },
    });
    expect(escrowTx?.amount).toBe(10);
    expect(escrowTx?.toUserId).toBeNull();
  });

  it('complete releases the escrow to the payee and closes the listing', async () => {
    const listing = await ListingModel.findById(createdListings[0]).lean();
    const contractId = String(listing?.contractId);
    const payeeBefore = await balanceOf(authorId);

    const res = await request(app)
      .post(`/contracts/${contractId}/complete`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(res.status).toBe(200);
    expect((res.body as ContractResp).status).toBe('completed');

    expect(await balanceOf(authorId)).toBe(payeeBefore + 10);
    const refreshed = await ListingModel.findById(createdListings[0]).lean();
    expect(refreshed?.status).toBe('closed');
  });

  it('cancel after escrow refunds the payer and reopens the listing', async () => {
    // nouveau cycle complet : offre → accept → 2 signatures → cancel
    const create = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ annulation',
        kind: 'offer',
        category: CATEGORY_SLUG,
        pricePoints: 20,
      });
    const listing = create.body as ListingResp;
    createdListings.push(listing._id);

    const accept = await request(app)
      .post(`/listings/${listing._id}/accept`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    const contractId = (accept.body as AcceptResp).contract._id;
    await request(app)
      .post(`/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${authorToken}`);
    await request(app)
      .post(`/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${acceptorToken}`);

    const payerAfterEscrow = await balanceOf(acceptorId);
    const res = await request(app)
      .post(`/contracts/${contractId}/cancel`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    expect(res.status).toBe(200);
    expect((res.body as ContractResp).status).toBe('cancelled');

    expect(await balanceOf(acceptorId)).toBe(payerAfterEscrow + 20);
    const refreshed = await ListingModel.findById(listing._id).lean();
    expect(refreshed?.status).toBe('open');
    expect(refreshed?.contractId).toBeNull();
  });

  it('a third party cannot sign a contract', async () => {
    const listing = await ListingModel.findById(createdListings.at(-1)).lean();
    // l'annonce a été rouverte : re-accepter pour avoir un contrat frais
    const accept = await request(app)
      .post(`/listings/${String(listing?._id)}/accept`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    expect(accept.status).toBe(201);
    const contractId = (accept.body as AcceptResp).contract._id;

    const res = await request(app)
      .post(`/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('admin categories CRUD is admin-only and drives listing creation', async () => {
    const forbidden = await request(app)
      .post('/admin/listing-categories')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ label: 'Interdit' });
    expect(forbidden.status).toBe(403);

    const created = await request(app)
      .post('/admin/listing-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: `Test Jardin ${STAMP}` });
    expect(created.status).toBe(201);
    const cat = created.body as { id: string; slug: string };

    const list = await request(app)
      .get('/listing-categories')
      .set('Authorization', `Bearer ${authorToken}`);
    expect(list.status).toBe(200);
    expect(
      (list.body as { items: Array<{ slug: string }> }).items.some((c) => c.slug === cat.slug),
    ).toBe(true);

    const del = await request(app)
      .delete(`/admin/listing-categories/${cat.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
  });

  it('admin can delete any listing, refunding an active escrow', async () => {
    // contrat frais du test précédent : le signer 2x pour le mettre sous séquestre
    const listing = await ListingModel.findById(createdListings.at(-1)).lean();
    const contractId = String(listing?.contractId);
    await request(app)
      .post(`/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${authorToken}`);
    await request(app)
      .post(`/contracts/${contractId}/sign`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    const payerAfterEscrow = await balanceOf(acceptorId);

    const forbidden = await request(app)
      .delete(`/listings/${String(listing?._id)}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(forbidden.status).toBe(403);

    const res = await request(app)
      .delete(`/listings/${String(listing?._id)}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    expect(await balanceOf(acceptorId)).toBe(payerAfterEscrow + 20);
    expect(await ListingModel.findById(String(listing?._id)).lean()).toBeNull();
    const contract = await ContractModel.findById(contractId).lean();
    expect(contract?.status).toBe('cancelled');
  });
});
