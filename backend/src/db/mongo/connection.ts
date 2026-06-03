import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../../logger/index.js';

const CONNECT_MAX_ATTEMPTS = 10;
const CONNECT_RETRY_DELAY_MS = 1_000;

let connectionPromise: Promise<typeof mongoose> | null = null;
let listenersRegistered = false;

function registerMongoListeners(): void {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;
  mongoose.connection.on('connected', () => logger.info('mongo connected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'mongo error'));
  mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(): Promise<typeof mongoose> {
  registerMongoListeners();

  for (let attempt = 1; attempt <= CONNECT_MAX_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(env.MONGO_URL, {
        serverSelectionTimeoutMS: 5_000,
        maxPoolSize: 20,
      });
      return mongoose;
    } catch (err) {
      if (mongoose.connection.readyState !== mongoose.ConnectionStates.disconnected) {
        await mongoose.disconnect().catch(() => undefined);
      }
      if (attempt === CONNECT_MAX_ATTEMPTS) {
        throw err;
      }
      logger.warn(
        { err, attempt, maxAttempts: CONNECT_MAX_ATTEMPTS },
        'mongo connect failed, retrying',
      );
      await sleep(CONNECT_RETRY_DELAY_MS);
    }
  }

  throw new Error('mongo connect: exhausted retries');
}

export function connectMongo(): Promise<typeof mongoose> {
  if (!connectionPromise) {
    connectionPromise = connectWithRetry().catch((err) => {
      connectionPromise = null;
      throw err;
    });
  }
  return connectionPromise;
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.disconnected) {
    await mongoose.disconnect();
  }
  connectionPromise = null;
}

export async function checkMongoHealth(): Promise<boolean> {
  try {
    if (
      mongoose.connection.readyState !== mongoose.ConnectionStates.connected ||
      !mongoose.connection.db
    ) {
      return false;
    }
    const result = await mongoose.connection.db.admin().ping();
    return result.ok === 1;
  } catch (err) {
    logger.warn({ err }, 'mongo healthcheck failed');
    return false;
  }
}
