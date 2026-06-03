import neo4j, { type Driver, type Session } from 'neo4j-driver';
import { env } from '../../config/env.js';
import { logger } from '../../logger/index.js';

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(env.NEO4J_URL, neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 10_000,
    });
  }
  return driver;
}

export function neo4jSession(database = 'neo4j'): Session {
  return getNeo4jDriver().session({ database });
}

export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

export async function checkNeo4jHealth(): Promise<boolean> {
  try {
    await getNeo4jDriver().verifyConnectivity();
    return true;
  } catch (err) {
    logger.warn({ err }, 'neo4j healthcheck failed');
    return false;
  }
}
