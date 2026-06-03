import mongoose, { Types } from 'mongoose';
import { EventModel } from '../db/mongo/models/event.model.js';
import { prisma } from '../db/prisma.js';
import {
  mergeUserNeighbourhood,
  relateInterested,
  removeInterested,
  recommendEvents,
  upsertEventNode,
  deleteEventNode,
} from './neo4j.js';
import type { EventCreateInput } from './schemas.js';

export async function syncUserNeo4jProfile(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { neighbourhoodId: true },
  });
  await mergeUserNeighbourhood({
    userId,
    neighbourhoodId: user?.neighbourhoodId ?? null,
  });
}

async function neo4jAfterSave(eventDoc: {
  id: string;
  neighbourhoodId: string;
  startsAt: Date;
}): Promise<void> {
  await upsertEventNode({
    eventId: eventDoc.id,
    neighbourhoodId: eventDoc.neighbourhoodId,
    startsAtIso: eventDoc.startsAt.toISOString(),
  });
}

export async function createEventOrganizer(userId: string, input: EventCreateInput) {
  await syncUserNeo4jProfile(userId);

  let location:
    | { type: 'Point'; coordinates: [number, number]; address?: string }
    | undefined;
  if (input.lon !== undefined && input.lat !== undefined) {
    if (input.address !== undefined) {
      location = { type: 'Point', coordinates: [input.lon, input.lat], address: input.address };
    } else {
      location = { type: 'Point', coordinates: [input.lon, input.lat] };
    }
  }

  const doc = await EventModel.create({
    title: input.title,
    description: input.description ?? '',
    organizerId: userId,
    neighbourhoodId: input.neighbourhoodId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    location,
    capacity: input.capacity ?? null,
    status: 'draft',
  });

  const id = String(doc._id);
  await neo4jAfterSave({ id, neighbourhoodId: doc.neighbourhoodId, startsAt: doc.startsAt });

  return doc;
}

export async function listPublishedEvents(neighbourhoodId: string) {
  return EventModel.find({
    neighbourhoodId,
    status: 'published',
  })
    .sort({ startsAt: 1 })
    .limit(100)
    .exec();
}

export async function publishEvent(eventId: string, userId: string) {
  const doc = await EventModel.findById(eventId);
  if (!doc) return null;
  if (doc.organizerId !== userId) throw new Error('forbidden');
  if (!(doc.endsAt > doc.startsAt)) throw new Error('invalid_dates');
  doc.status = 'published';
  await doc.save();
  await neo4jAfterSave({
    id: String(doc._id),
    neighbourhoodId: doc.neighbourhoodId,
    startsAt: doc.startsAt,
  });
  return doc;
}

export async function cancelEvent(eventId: string, userId: string) {
  const doc = await EventModel.findById(eventId);
  if (!doc) return null;
  if (doc.organizerId !== userId) throw new Error('forbidden');
  doc.status = 'cancelled';
  await doc.save();
  await deleteEventNode(String(doc._id));
  return doc;
}

export async function expressInterest(eventId: string, userId: string) {
  await syncUserNeo4jProfile(userId);
  const doc = await EventModel.findById(eventId);
  if (!doc) return null;
  if (doc.status !== 'published') throw new Error('not_published');
  if (!doc.interested.includes(userId)) {
    doc.interested.push(userId);
    doc.declined = doc.declined.filter((id) => id !== userId);
    await doc.save();
  }
  await neo4jAfterSave({
    id: String(doc._id),
    neighbourhoodId: doc.neighbourhoodId,
    startsAt: doc.startsAt,
  });
  await relateInterested(userId, String(doc._id));
  return doc;
}

export async function declineEvent(eventId: string, userId: string) {
  await syncUserNeo4jProfile(userId);
  const doc = await EventModel.findById(eventId);
  if (!doc) return null;
  if (doc.status !== 'published') throw new Error('not_published');
  if (!doc.declined.includes(userId)) {
    doc.declined.push(userId);
    doc.interested = doc.interested.filter((id) => id !== userId);
    await doc.save();
  }
  await removeInterested(userId, String(doc._id));
  return doc;
}

export async function getRecommendations(userId: string, neighbourhoodId: string) {
  const ids = await recommendEvents({ userId, neighbourhoodId });
  if (ids.length === 0) return [];
  const objectIds = ids
    .filter((x) => mongoose.isValidObjectId(x))
    .map((x) => new Types.ObjectId(x));
  if (objectIds.length === 0) return [];
  return EventModel.find({
    _id: { $in: objectIds },
    status: 'published',
  }).exec();
}
