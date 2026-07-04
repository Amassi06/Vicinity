import sharp from 'sharp';
import type { MessageEntity } from '../db/mongo/models/message.model.js';
import { MessageModel } from '../db/mongo/models/message.model.js';
import { MessageCreateSchema, type AttachmentKindSchema } from './schemas.js';
import { saveBuffer } from '../storage/index.js';
import type { z } from 'zod';

export type MessageCreateInput = z.infer<typeof MessageCreateSchema>;
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>;

export interface UploadedAttachment {
  storageKey: string;
  contentType: string;
  size: number;
  kind: AttachmentKind;
}

export async function uploadMessageAttachment(
  buffer: Buffer,
  contentType: string,
  kind: AttachmentKind,
): Promise<UploadedAttachment> {
  // Les images sont redimensionnées et bornées à 200×200 px (cf. cahier des
  // charges) et normalisées en PNG. Les autres pièces jointes sont stockées
  // telles quelles.
  if (kind === 'image') {
    const resized = await sharp(buffer)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const stored = await saveBuffer(resized);
    return { storageKey: stored.storageKey, contentType: 'image/png', size: stored.bytes, kind };
  }

  const stored = await saveBuffer(buffer);
  return {
    storageKey: stored.storageKey,
    contentType,
    size: stored.bytes,
    kind,
  };
}

/** Retrouve une pièce jointe d'une conversation (pour le téléchargement). */
export async function findAttachment(
  conversationId: string,
  storageKey: string,
): Promise<{ contentType: string } | null> {
  const msg = await MessageModel.findOne(
    { conversationId, 'attachments.storageKey': storageKey },
    { 'attachments.$': 1 },
  ).lean();
  const att = msg?.attachments?.[0];
  return att ? { contentType: att.contentType } : null;
}

export async function listRecentMessages(conversationId: string, limit = 80): Promise<MessageEntity[]> {
  return MessageModel.find({ conversationId, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
}

export async function createMessage(senderId: string, conversationId: string, raw: unknown) {
  const parsed = MessageCreateSchema.safeParse(raw);
  if (!parsed.success) {
    throw Object.assign(new Error('invalid_body'), {
      cause: parsed.error.flatten(),
    });
  }

  if (!parsed.data.body && (parsed.data.attachments ?? []).length === 0) {
    throw new Error('empty_message');
  }

  const doc = await MessageModel.create({
    conversationId,
    senderId,
    body: parsed.data.body ?? '',
    attachments: parsed.data.attachments ?? [],
    readBy: [senderId],
    deliveredTo: [],
  });

  return doc.toJSON() as Record<string, unknown>;
}

/** Marque comme lus tous les messages d'une conversation pour cet utilisateur. */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await MessageModel.updateMany(
    { conversationId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } },
  );
}

/**
 * Nombre de messages non lus par l'utilisateur dans une liste de conversations
 * (messages qu'il n'a pas envoyés et où il n'est pas dans `readBy`).
 */
export async function countUnreadMessages(
  userId: string,
  conversationIds: string[],
): Promise<number> {
  if (conversationIds.length === 0) return 0;
  return MessageModel.countDocuments({
    conversationId: { $in: conversationIds },
    senderId: { $ne: userId },
    readBy: { $ne: userId },
    deletedAt: null,
  });
}

/** Conversations DM où l'utilisateur apparaît, avec l'id de l'autre membre. */
export async function listDmPartnerIds(userId: string): Promise<string[]> {
  const ids = await MessageModel.distinct('conversationId', {
    conversationId: { $regex: `(^dm:${userId}:)|(:${userId}$)` },
  });
  const partners = new Set<string>();
  for (const cid of ids as string[]) {
    const rest = cid.slice('dm:'.length).split(':');
    for (const id of rest) if (id && id !== userId) partners.add(id);
  }
  return [...partners];
}
