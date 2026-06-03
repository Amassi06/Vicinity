/**
 * Test E2E /readyz — requiert la stack docker DEV complète (`make up`).
 */
import request from 'supertest';
import { createApp } from '../src/http/app';
import { prisma } from '../src/db/prisma';
import { connectMongo, disconnectMongo } from '../src/db/mongo/connection';
import { getNeo4jDriver, closeNeo4j } from '../src/db/neo4j/driver';

const TEST_TIMEOUT_MS = 20_000;

interface ReadyzBody {
  status: 'ready' | 'degraded';
  checks: {
    postgres: boolean;
    mongo: boolean;
    neo4j: boolean;
    storage: { ok: boolean; backend: string };
  };
}

describe('GET /readyz', () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$connect();
    await connectMongo();
    getNeo4jDriver();
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await disconnectMongo();
    await closeNeo4j();
    await prisma.$disconnect();
  }, TEST_TIMEOUT_MS);

  it(
    'returns 200 with all checks green when the full stack is up',
    async () => {
      const res = await request(app).get('/readyz');
      const body = res.body as ReadyzBody;

      expect(res.status).toBe(200);
      expect(body.status).toBe('ready');
      expect(body.checks).toMatchObject({
        postgres: true,
        mongo: true,
        neo4j: true,
        storage: { ok: true, backend: 'local' },
      });
    },
    TEST_TIMEOUT_MS,
  );
});
