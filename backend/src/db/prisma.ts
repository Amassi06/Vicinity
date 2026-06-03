import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/index.js';

export const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('warn', (e) => logger.warn({ prisma: e }, 'prisma warning'));
prisma.$on('error', (e) => logger.error({ prisma: e }, 'prisma error'));

export async function checkPostgresHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.warn({ err }, 'postgres healthcheck failed');
    return false;
  }
}
