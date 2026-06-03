import type { MessageEntity } from '../db/mongo/models/message.model.js';
import { MessageModel } from '../db/mongo/models/message.model.js';
import { MessageCreateSchema } from './schemas.js';
import type { z } from 'zod';

export type MessageCreateInput = z.infer<typeof MessageCreateSchema>;

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
