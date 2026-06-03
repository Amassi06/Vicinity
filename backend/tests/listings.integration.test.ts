/**
 * Tests E2E annonces + contrats. Requiert Postgres + Mongo (`make up`).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import {
  ContractModel,
  ListingModel,
} from '../src/db/mongo/models';
import { creditPoints } from '../src/wallet/service';

const TIMEOUT_MS = 30_000;
const STAMP = Date.now();
const AUTHOR = `__listing_author_${STAMP}@example.com`;
const ACCEPTOR = `__listing_buyer_${STAMP}@example.com`;
const PASSWORD = 'sup3rstrongpass';
const NEIGHBOURHOOD_ID = '00000000-0000-0000-0000-000000000001';

interface AuthBody {
  accessToken: string;
  user: { id: string };
}

interface ListingResp {
  _id: string;
  status: string;
  contractId: string | null;
  authorId: string;
}

interface ContractResp {
  _id: string;
  status: string;
  pricePoints: number;
  payerId: string;
  payeeId: string;
}

interface AcceptResp {
  listing: ListingResp;
  contract: ContractResp;
}

async function signup(app: ReturnType<typeof createApp>, email: string): Promise<AuthBody> {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: PASSWORD, displayName: email });
  return res.body as AuthBody;
}

describe('Listings — CRUD + accept flow', () => {
  const app = createApp();
  let authorId = '';
  let acceptorId = '';
  let authorToken = '';
  let acceptorToken = '';
  const createdListings: string[] = [];

  beforeAll(async () => {
    await Promise.all([prisma.$connect(), connectMongo()]);
    const author = await signup(app, AUTHOR);
    const acceptor = await signup(app, ACCEPTOR);
    authorId = author.user.id;
    acceptorId = acceptor.user.id;
    authorToken = author.accessToken;
    acceptorToken = acceptor.accessToken;
    await creditPoints({ toUserId: acceptorId, amount: 50, reason: 'WELCOME_BONUS' });
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (createdListings.length) {
      await ContractModel.deleteMany({ listingId: { $in: createdListings } });
      await ListingModel.deleteMany({ _id: { $in: createdListings } });
    }
    const ids = [authorId, acceptorId].filter(Boolean);
    if (ids.length) {
      await prisma.pointTransaction.deleteMany({
        where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] },
      });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await Promise.all([prisma.$disconnect(), disconnectMongo()]);
  }, TIMEOUT_MS);

  it('POST /listings creates a listing', async () => {
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ tonte de pelouse',
        description: 'rien de fou',
        kind: 'offer',
        category: 'jardinage',
        pricePoints: 10,
      });
    expect(res.status).toBe(201);
    const body = res.body as ListingResp;
    expect(body.status).toBe('open');
    expect(body.authorId).toBe(authorId);
    createdListings.push(body._id);
  });

  it('GET /listings returns the created listing', async () => {
    const res = await request(app)
      .get(`/listings?neighbourhoodId=${NEIGHBOURHOOD_ID}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(res.status).toBe(200);
    const body = res.body as { items: ListingResp[] };
    expect(body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('cannot accept own listing', async () => {
    const listingId = createdListings[0]!;
    const res = await request(app)
      .post(`/listings/${listingId}/accept`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(res.status).toBe(409);
    expect((res.body as { error: string }).error).toBe('cannot_accept_own_listing');
  });

  it('accept transfers points and creates a contract', async () => {
    const listingId = createdListings[0]!;
    const res = await request(app)
      .post(`/listings/${listingId}/accept`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    expect(res.status).toBe(201);
    const body = res.body as AcceptResp;
    expect(body.contract.status).toBe('pending');
    expect(body.contract.pricePoints).toBe(10);
    expect(body.contract.payerId).toBe(acceptorId);
    expect(body.contract.payeeId).toBe(authorId);
    expect(body.listing.status).toBe('in_progress');
    expect(body.listing.contractId).toBe(body.contract._id);

    const acceptorRow = await prisma.user.findUnique({ where: { id: acceptorId } });
    const authorRow = await prisma.user.findUnique({ where: { id: authorId } });
    expect(acceptorRow?.pointsBalance).toBe(40);
    expect(authorRow?.pointsBalance).toBe(10);
  });

  it('cannot accept the same listing twice', async () => {
    const listingId = createdListings[0]!;
    const res = await request(app)
      .post(`/listings/${listingId}/accept`)
      .set('Authorization', `Bearer ${acceptorToken}`);
    expect(res.status).toBe(409);
  });

  it('rejects accept when buyer cannot pay (insufficient funds)', async () => {
    const create = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        neighbourhoodId: NEIGHBOURHOOD_ID,
        title: '__test__ trop cher',
        kind: 'offer',
        category: 'reparation',
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

  it('contract complete by either party closes the listing', async () => {
    const acceptedListingId = createdListings[0]!;
    const listing = await ListingModel.findById(acceptedListingId).lean();
    const contractId = listing?.contractId;
    expect(contractId).toBeDefined();
    const res = await request(app)
      .post(`/contracts/${contractId}/complete`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(res.status).toBe(200);
    expect((res.body as ContractResp).status).toBe('completed');
    const refreshedListing = await ListingModel.findById(acceptedListingId).lean();
    expect(refreshedListing?.status).toBe('closed');
  });
});
