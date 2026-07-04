import { z } from 'zod';

export const AttachmentKindSchema = z.enum(['image', 'audio', 'video', 'file']);

const AttachmentSchema = z.object({
  storageKey: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  kind: AttachmentKindSchema,
});

export const MessageCreateSchema = z.object({
  body: z.string().max(20_000).default(''),
  attachments: z.array(AttachmentSchema).max(12).optional().default([]),
});
