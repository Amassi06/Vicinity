import { neo4jSession } from '../db/neo4j/driver.js';

/** Projette un événement Mongo dans Neo4j pour les relations d’intérêt / reco. */
export async function upsertEventNode(input: {
  eventId: string;
  neighbourhoodId: string;
  startsAtIso: string;
}): Promise<void> {
  const session = neo4jSession();
  try {
    await session.run(
      `
      MERGE (e:Event {id: $id})
      SET e.neighbourhoodId = $nid, e.startsAt = $starts
      `,
      { id: input.eventId, nid: input.neighbourhoodId, starts: input.startsAtIso },
    );
  } finally {
    await session.close();
  }
}

export async function deleteEventNode(eventId: string): Promise<void> {
  const session = neo4jSession();
  try {
    await session.run(
      `
      MATCH (e:Event {id: $id})
      DETACH DELETE e
      `,
      { id: eventId },
    );
  } finally {
    await session.close();
  }
}

export async function mergeUserNeighbourhood(input: {
  userId: string;
  neighbourhoodId: string | null;
}): Promise<void> {
  const session = neo4jSession();
  const nid = input.neighbourhoodId ?? 'unset';
  try {
    await session.run(
      `
      MERGE (u:User {id: $uid})
      SET u.neighbourhoodId = $nid
      `,
      { uid: input.userId, nid },
    );
    if (input.neighbourhoodId) {
      await session.run(
        `
        MERGE (n:Neighbourhood {id: $nid})
        WITH n
        MATCH (u:User {id: $uid})
        MERGE (u)-[:LIVES_IN]->(n)
        `,
        { uid: input.userId, nid: input.neighbourhoodId },
      );
    }
  } finally {
    await session.close();
  }
}

export async function relateInterested(userId: string, eventId: string): Promise<void> {
  const session = neo4jSession();
  try {
    await session.run(
      `
      MATCH (u:User {id: $uid}), (e:Event {id: $eid})
      MERGE (u)-[:INTERESTED_IN]->(e)
      `,
      { uid: userId, eid: eventId },
    );
  } finally {
    await session.close();
  }
}

export async function removeInterested(userId: string, eventId: string): Promise<void> {
  const session = neo4jSession();
  try {
    await session.run(
      `
      MATCH (u:User {id: $uid})-[r:INTERESTED_IN]->(e:Event {id: $eid})
      DELETE r
      `,
      { uid: userId, eid: eventId },
    );
  } finally {
    await session.close();
  }
}

/**
 * Reco simple : autres événements du quartier intéressant des utilisateurs qui
 * partagent au moins un centre d’intérêt commun avec moi.
 */
export async function recommendEvents(input: {
  userId: string;
  neighbourhoodId: string;
}): Promise<string[]> {
  const session = neo4jSession();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $uid})-[:INTERESTED_IN]->(seed:Event)
      WHERE seed.neighbourhoodId = $nid
      MATCH (buddy:User)-[:INTERESTED_IN]->(seed)
      WHERE buddy.id <> $uid
      MATCH (buddy)-[:INTERESTED_IN]->(rec:Event)
      WHERE rec.neighbourhoodId = $nid AND NOT EXISTS { (u)-[:INTERESTED_IN]->(rec) }
      RETURN DISTINCT rec.id AS id
      LIMIT 15
      `,
      { uid: input.userId, nid: input.neighbourhoodId },
    );

    const ids: string[] = [];
    for (const row of result.records) {
      const raw: unknown = row.get('id');
      if (typeof raw !== 'string' || raw.length === 0) {
        continue;
      }
      ids.push(raw);
    }
    return ids;
  } catch {
    return [];
  } finally {
    await session.close();
  }
}

/**
 * "Amis" d'un utilisateur : voisins avec qui il partage au moins un centre
 * d'intérêt (co-intéressés au même événement). Sert à mettre en avant les amis
 * intéressés par un événement côté habitant.
 */
export async function friendsOf(userId: string): Promise<string[]> {
  const session = neo4jSession();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $uid})-[:INTERESTED_IN]->(seed:Event)<-[:INTERESTED_IN]-(friend:User)
      WHERE friend.id <> $uid
      RETURN DISTINCT friend.id AS id
      `,
      { uid: userId },
    );
    const ids: string[] = [];
    for (const row of result.records) {
      const raw: unknown = row.get('id');
      if (typeof raw === 'string' && raw.length > 0) ids.push(raw);
    }
    return ids;
  } catch {
    return [];
  } finally {
    await session.close();
  }
}
