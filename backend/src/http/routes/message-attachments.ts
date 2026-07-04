import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireAuth } from '../../auth/middleware.js';
import { AttachmentKindSchema } from '../../messages/schemas.js';
import { findAttachment, uploadMessageAttachment } from '../../messages/service.js';
import { canAccessConversation } from '../../messages/conversations.js';
import { readStoredFile } from '../../storage/index.js';
import { registerModule } from '../../plugins/module-registry.js';

export const messageAttachmentsRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.STORAGE_MAX_ATTACHMENT_BYTES },
});

const ConvParamSchema = z.object({
  cid: z.string().min(8).max(120),
});

const AttachmentBodySchema = z.object({
  kind: AttachmentKindSchema,
});

messageAttachmentsRouter.post(
  '/conversations/:cid/attachments',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    const params = ConvParamSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'invalid_conversation_id' });
      return;
    }
    if (!(await canAccessConversation(req.auth!.sub, params.data.cid))) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'missing_file' });
      return;
    }
    const body = AttachmentBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'invalid_input', issues: body.error.issues });
      return;
    }
    const attachment = await uploadMessageAttachment(
      req.file.buffer,
      req.file.mimetype,
      body.data.kind,
    );
    res.status(201).json(attachment);
  },
);

const AttachmentGetParams = z.object({
  cid: z.string().min(8).max(120),
  key: z.string().min(1).max(300),
});

messageAttachmentsRouter.get(
  '/conversations/:cid/attachments/:key',
  requireAuth,
  async (req, res) => {
    const params = AttachmentGetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'invalid_input' });
      return;
    }
    if (!(await canAccessConversation(req.auth!.sub, params.data.cid))) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const att = await findAttachment(params.data.cid, params.data.key);
    if (!att) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    try {
      const buffer = await readStoredFile(params.data.key);
      res.setHeader('Content-Type', att.contentType);
      res.send(buffer);
    } catch {
      res.status(404).json({ error: 'not_found' });
    }
  },
);

registerModule({
  id: 'message-attachments',
  description: "Upload de pièces jointes (photo/vocal) pour la messagerie.",
  router: messageAttachmentsRouter,
});
