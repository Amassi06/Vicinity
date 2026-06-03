import { z } from 'zod';

const AttachmentSchema = z.object({
  storageKey: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  kind: z.enum(['image', 'audio', 'video', 'file']),
});

export const MessageCreateSchema = z.object({
  body: z.string().max(20_000).default(''),
  attachments: z.array(AttachmentSchema).max(12).optional().default([]),
});
