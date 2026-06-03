import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../auth/middleware.js';
import { compileMongoFindDsl, DSLParseError } from '../../dsl/mini-find-lang.js';

export const dslRouter = Router();

const BodySchema = z.object({
  dsl: z.string().min(1).max(10_000),
});

dslRouter.post(
  '/dsl/compile',
  requireAuth,
  requireRole('MODERATOR', 'ADMIN'),
  (req, res) => {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
      return;
    }

    try {
      const compiled = compileMongoFindDsl(parsed.data.dsl);
      res.json({ compiled });
    } catch (err) {
      if (err instanceof DSLParseError) {
        res.status(400).json({ error: 'dsl_parse_error', detail: err.message });
        return;
      }
      throw err;
    }
  },
);
