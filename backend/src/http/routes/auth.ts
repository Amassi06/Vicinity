import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as authService from '../../auth/service.js';
import { requireAuth, requireRole } from '../../auth/middleware.js';
import { logger } from '../../logger/index.js';
import { prisma } from '../../db/prisma.js';
import { writeAuditLog } from '../../audit/service.js';

const router = Router();

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(120),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.socket.remoteAddress ?? undefined;
}

router.post('/auth/signup', async (req: Request, res: Response) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await authService.signup(parsed.data);
    res.status(201).json(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      res.status(409).json({ error: 'email_already_registered' });
      return;
    }
    logger.error({ err }, 'signup failed');
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/auth/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }
  try {
    const result = await authService.login(parsed.data.email, parsed.data.password);
    await writeAuditLog({
      userId: result.user.id,
      action: 'LOGIN',
      ipAddress: clientIp(req) ?? null,
    });
    res.status(200).json(result);
  } catch {
    res.status(401).json({ error: 'invalid_credentials' });
  }
});

router.post('/auth/refresh', async (req: Request, res: Response) => {
  const parsed = RefreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }
  try {
    const tokens = await authService.refresh(parsed.data.refreshToken);
    res.status(200).json(tokens);
  } catch {
    res.status(401).json({ error: 'invalid_session' });
  }
});

router.post('/auth/logout', async (req: Request, res: Response) => {
  const parsed = RefreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }
  const userId = await authService.logout(parsed.data.refreshToken);
  if (userId) {
    await writeAuditLog({ userId, action: 'LOGOUT', ipAddress: clientIp(req) ?? null });
  }
  res.status(204).send();
});

router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    select: { email: true, role: true, mfaEnabled: true },
  });
  if (!user) {
    res.status(404).json({ error: 'user_not_found' });
    return;
  }
  res.status(200).json({
    sub: req.auth!.sub,
    email: user.email,
    role: user.role,
    mfa: user.mfaEnabled,
  });
});

router.get('/auth/admin-only', requireAuth, requireRole('ADMIN'), (_req, res) => {
  res.status(200).json({ ok: true });
});

// ----------------------------------------------------------------------------
// MFA (TOTP — RFC 6238)
// ----------------------------------------------------------------------------

const TotpSchema = z.object({ token: z.string().min(6).max(8) });

router.post('/auth/mfa/enroll', requireAuth, async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  const enrollment = await authService.enrollMfa(req.auth.sub);
  res.status(200).json(enrollment);
});

router.post('/auth/mfa/activate', requireAuth, async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  const parsed = TotpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }
  try {
    await authService.activateMfa(req.auth.sub, parsed.data.token);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/auth/mfa/verify', requireAuth, async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  const parsed = TotpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }
  const ok = await authService.verifyMfaForUser(req.auth.sub, parsed.data.token);
  res.status(ok ? 200 : 401).json({ valid: ok });
});

router.post('/auth/mfa/disable', requireAuth, async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  const parsed = TotpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }
  try {
    await authService.disableMfa(req.auth.sub, parsed.data.token);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ----------------------------------------------------------------------------
// SSO — émet un token d'accès consommable par le client desktop JavaFX
// ----------------------------------------------------------------------------

router.post('/auth/sso/issue', requireAuth, async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  const result = await authService.issueSsoToken(req.auth.sub);
  res.status(200).json(result);
});

export const authRouter = router;
