import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import {
  deleteUserAccount,
  exportUserData,
  getConsents,
  updateConsents,
  type ConsentKey,
} from '../../gdpr/service.js';

export const gdprRouter = Router();

const ConsentPatchSchema = z.object({
  marketing: z.boolean().optional(),
  analytics: z.boolean().optional(),
  neighbourhood_digest: z.boolean().optional(),
});

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.socket.remoteAddress ?? undefined;
}

gdprRouter.get('/me/export', requireAuth, async (req: Request, res: Response) => {
  const data = await exportUserData(req.auth!.sub, clientIp(req));
  if (!data) {
    res.status(404).json({ error: 'user_not_found' });
    return;
  }
  res.status(200).json(data);
});

gdprRouter.post('/me/delete-account', requireAuth, async (req: Request, res: Response) => {
  try {
    await deleteUserAccount(req.auth!.sub, clientIp(req));
    res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'delete_failed';
    res.status(msg === 'user_not_found' ? 404 : 400).json({ error: msg });
  }
});

gdprRouter.get('/me/consents', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({ consents: getConsents(req.auth!.sub) });
});

gdprRouter.patch('/me/consents', requireAuth, async (req: Request, res: Response) => {
  const parsed = ConsentPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
    return;
  }
  const consents = await updateConsents(
    req.auth!.sub,
    parsed.data as Partial<Record<ConsentKey, boolean>>,
    clientIp(req),
  );
  res.status(200).json({ consents });
});
