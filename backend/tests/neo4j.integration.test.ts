/**
 * Test d'intégration Neo4j — requiert la stack docker DEV (`make up`).
 */
import {
  getNeo4jDriver,
  neo4jSession,
  closeNeo4j,
  checkNeo4jHealth,
} from '../src/db/neo4j/driver';
import { applyNeo4jConstraints } from '../src/db/neo4j/constraints';

const TEST_TIMEOUT_MS = 20_000;

describe('Neo4j integration', () => {
  beforeAll(async () => {
    getNeo4jDriver();
    await applyNeo4jConstraints();
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    const session = neo4jSession();
    try {
      await session.run("MATCH (u:User {id: '__test__'}) DETACH DELETE u");
    } finally {
      await session.close();
    }
    await closeNeo4j();
  }, TEST_TIMEOUT_MS);

  it('verifyConnectivity succeeds', async () => {
    await expect(checkNeo4jHealth()).resolves.toBe(true);
  });

  it('constraint user_id_unique is registered', async () => {
    const session = neo4jSession();
    try {
      const result = await session.run('SHOW CONSTRAINTS YIELD name WHERE name = $n RETURN name', {
        n: 'user_id_unique',
      });
      expect(result.records.length).toBe(1);
    } finally {
      await session.close();
    }
  });

  it('refuses duplicate User.id', async () => {
    const session = neo4jSession();
    try {
      await session.run("MERGE (u:User {id: '__test__'})");
      await expect(
        session.run("CREATE (u:User {id: '__test__'}) RETURN u"),
      ).rejects.toThrow(/already exists|ConstraintValidationFailed/i);
    } finally {
      await session.close();
    }
  });
});
