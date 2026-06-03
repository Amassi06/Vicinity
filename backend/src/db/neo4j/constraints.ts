import { neo4jSession } from './driver.js';
import { logger } from '../../logger/index.js';

/**
 * Contraintes et index Cypher pour le graphe social de Connected Neighbours.
 * Idempotent : ré-applicable à chaque démarrage sans effet de bord.
 */
const STATEMENTS: readonly string[] = [
  'CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
  'CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE',
  'CREATE CONSTRAINT listing_id_unique IF NOT EXISTS FOR (l:Listing) REQUIRE l.id IS UNIQUE',
  'CREATE CONSTRAINT neighbourhood_id_unique IF NOT EXISTS FOR (n:Neighbourhood) REQUIRE n.id IS UNIQUE',
  'CREATE INDEX user_neighbourhood_idx IF NOT EXISTS FOR (u:User) ON (u.neighbourhoodId)',
  'CREATE INDEX event_neighbourhood_idx IF NOT EXISTS FOR (e:Event) ON (e.neighbourhoodId)',
  'CREATE INDEX event_starts_at_idx IF NOT EXISTS FOR (e:Event) ON (e.startsAt)',
];

export async function applyNeo4jConstraints(): Promise<void> {
  const session = neo4jSession();
  try {
    for (const stmt of STATEMENTS) {
      await session.run(stmt);
    }
    logger.info({ count: STATEMENTS.length }, 'neo4j constraints applied');
  } finally {
    await session.close();
  }
}
