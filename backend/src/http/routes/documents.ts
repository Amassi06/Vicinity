import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireAuth } from '../../auth/middleware.js';
import {
  SetZonesSchema,
  SignZoneSchema,
} from '../../documents/schemas.js';
import {
  getDocument,
  getSignatureImageKey,
  listDocumentsForUser,
  listInboxDocuments,
  setZones,
  signZone,
  uploadDocument,
} from '../../documents/service.js';
import { readStoredFile } from '../../storage/index.js';
import { registerModule } from '../../plugins/module-registry.js';

export const documentsRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.STORAGE_MAX_PDF_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('only_pdf'));
      return;
    }
    cb(null, true);
  },
});

const IdParam = z.object({ id: z.string().min(1) });
const ZoneParam = z.object({ id: z.string().min(1), index: z.coerce.number().int().min(0) });

function parseId(req: Request): string | null {
  const parsed = IdParam.safeParse(req.params);
  return parsed.success ? parsed.data.id : null;
}

const UploadBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
});

documentsRouter.get('/documents', requireAuth, async (req, res) => {
  const items = await listDocumentsForUser(req.auth!.sub);
  res.json({ items });
});

documentsRouter.get('/documents/inbox', requireAuth, async (req, res) => {
  const items = await listInboxDocuments(req.auth!.sub);
  res.json({ items });
});

documentsRouter.post(
  '/documents',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'missing_file' });
      return;
    }
    const meta = UploadBodySchema.safeParse(req.body);
    if (!meta.success) {
      res.status(400).json({ error: 'invalid_input', issues: meta.error.issues });
      return;
    }
    try {
      const doc = await uploadDocument({
        ownerId: req.auth!.sub,
        title: meta.data.title,
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
      });
      res.status(201).json(doc);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      res.status(400).json({ error: message });
    }
  },
);

documentsRouter.get('/documents/:id', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const doc = await getDocument(id, req.auth!.sub);
    if (!doc) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    res.status(message === 'forbidden' ? 403 : 400).json({ error: message });
  }
});

documentsRouter.get('/documents/:id/file', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const doc = await getDocument(id, req.auth!.sub);
    if (!doc) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const buffer = await readStoredFile(doc.storageKey);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.title}.pdf"`);
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    res.status(message === 'forbidden' ? 403 : 400).json({ error: message });
  }
});

documentsRouter.post('/documents/:id/zones', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  const parsed = SetZonesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    return;
  }
  try {
    const updated = await setZones(id, req.auth!.sub, parsed.data);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    const statusByCode: Record<string, number> = {
      not_found: 404,
      forbidden: 403,
      invalid_state: 409,
    };
    res.status(statusByCode[message] ?? 400).json({ error: message });
  }
});

documentsRouter.post(
  '/documents/:id/zones/:index/sign',
  requireAuth,
  async (req, res) => {
    const params = ZoneParam.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'invalid_params' });
      return;
    }
    const body = SignZoneSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'invalid_input', issues: body.error.issues });
      return;
    }
    try {
      const doc = await signZone(params.data.id, params.data.index, req.auth!.sub, {
        signatureImage: body.data.signatureImage,
        ...(body.data.mfaToken ? { mfaToken: body.data.mfaToken } : {}),
      });
      res.json(doc);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      const statusByCode: Record<string, number> = {
        not_found: 404,
        forbidden: 403,
        invalid_state: 409,
        invalid_zone: 404,
        already_signed: 409,
        mfa_required: 401,
        rate_limited: 429,
        invalid_signature_image: 400,
      };
      res.status(statusByCode[message] ?? 400).json({ error: message });
    }
  },
);

documentsRouter.get('/documents/:id/zones/:index/signature', requireAuth, async (req, res) => {
  const params = ZoneParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: 'invalid_params' });
    return;
  }
  try {
    const key = await getSignatureImageKey(params.data.id, params.data.index, req.auth!.sub);
    if (!key) {
      res.status(404).json({ error: 'not_signed' });
      return;
    }
    const buffer = await readStoredFile(key);
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    const statusByCode: Record<string, number> = {
      not_found: 404,
      forbidden: 403,
      invalid_zone: 404,
    };
    res.status(statusByCode[message] ?? 400).json({ error: message });
  }
});

registerModule({
  id: 'documents',
  description: 'Documents PDF, zones de signature et signatures numériques.',
  router: documentsRouter,
});
