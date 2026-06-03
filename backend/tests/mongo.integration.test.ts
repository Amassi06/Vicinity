/**
 * Test d'intégration Mongo — requiert la stack docker DEV (`make up`).
 */
import { connectMongo, disconnectMongo, checkMongoHealth } from '../src/db/mongo/connection';
import { ListingModel } from '../src/db/mongo/models';

const TEST_TIMEOUT_MS = 15_000;

describe('Mongo integration', () => {
  beforeAll(async () => {
    await connectMongo();
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await ListingModel.deleteMany({ title: /^__test__/ });
    await disconnectMongo();
  }, TEST_TIMEOUT_MS);

  it('ping responds ok', async () => {
    await expect(checkMongoHealth()).resolves.toBe(true);
  });

  it('creates and reads a listing', async () => {
    const listing = await ListingModel.create({
      authorId: 'user-1',
      neighbourhoodId: 'neigh-1',
      title: '__test__ tonte de pelouse',
      description: 'test',
      kind: 'offer',
      category: 'jardinage',
      pricePoints: 4,
      isFree: false,
    });
    expect(listing.id).toBeDefined();

    const found = await ListingModel.findById(listing.id).lean();
    expect(found?.title).toBe('__test__ tonte de pelouse');
    expect(found?.status).toBe('open');
  });
});
