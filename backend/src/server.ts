import { createServer as createHttpServer } from 'node:http';
import { createApp } from './http/app.js';
import { env } from './config/env.js';
import { logger } from './logger/index.js';
import { prisma } from './db/prisma.js';
import { connectMongo, disconnectMongo } from './db/mongo/connection.js';
import { getNeo4jDriver, closeNeo4j } from './db/neo4j/driver.js';
import { applyNeo4jConstraints } from './db/neo4j/constraints.js';
import { attachSocketHttp, shutdownSockets } from './realtime/socket-server.js';
import { bootstrapPlugins } from './plugins/bootstrap.js';
import { initStorage } from './storage/index.js';

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  await connectMongo();
  getNeo4jDriver();
  await applyNeo4jConstraints();
  await initStorage();
  bootstrapPlugins();

  const app = createApp();
  const server = createHttpServer(app);
  attachSocketHttp(server);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'vicinity backend listening');
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void (async () => {
        await shutdownSockets();
        await disconnectMongo();
        await closeNeo4j();
        await prisma.$disconnect();
        process.exit(0);
      })();
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err: unknown) => {
  logger.fatal({ err }, 'failed to bootstrap backend');
  process.exit(1);
});
