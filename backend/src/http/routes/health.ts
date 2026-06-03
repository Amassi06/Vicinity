import { Router } from 'express';
import { checkPostgresHealth } from '../../db/prisma.js';
import { checkMongoHealth } from '../../db/mongo/connection.js';
import { checkNeo4jHealth } from '../../db/neo4j/driver.js';
import { activeStorageBackend, checkStorageHealth } from '../../storage/index.js';

const router = Router();

router.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

router.get('/readyz', async (_req, res) => {
  const [postgres, mongo, neo4j, storage] = await Promise.all([
    checkPostgresHealth(),
    checkMongoHealth(),
    checkNeo4jHealth(),
    checkStorageHealth(),
  ]);

  const checks = {
    postgres,
    mongo,
    neo4j,
    storage: { ok: storage, backend: activeStorageBackend() },
  };
  const allReady = postgres && mongo && neo4j && storage;

  res.status(allReady ? 200 : 503).json({
    status: allReady ? 'ready' : 'degraded',
    checks,
  });
});

export const healthRouter = router;
