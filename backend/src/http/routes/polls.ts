import mongoose from 'mongoose';
import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import { castVote, createPoll, getPoll, listPolls } from '../../polls/service.js';

export const pollsRouter = Router();

const MongoIdSchema = z.string().refine((s) => mongoose.isValidObjectId(s));

function parseMongoId(req: Request): string | null {
  const pid = MongoIdSchema.safeParse(req.params['id']);
  return pid.success ? pid.data : null;
}

pollsRouter.get('/polls', requireAuth, async (req, res) => {
  const q = z.object({ neighbourhoodId: z.string().uuid() }).safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: 'invalid_query', issues: q.error.issues });
    return;
  }
  const items = await listPolls(q.data.neighbourhoodId);
  res.json({ items });
});

pollsRouter.get('/polls/:id', requireAuth, async (req, res) => {
  const id = parseMongoId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }

  const envelope = await getPoll(id);
  if (!envelope) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(envelope);
});

pollsRouter.post('/polls', requireAuth, async (req, res) => {
  try {
    const doc = await createPoll(req.auth!.sub, req.body);
    res.status(201).json(doc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const statusByCode: Record<string, number> = {
      invalid_body: 400,
      unknown_poll_plugin: 400,
      plugin_min_three_options: 422,
    };
    res.status(statusByCode[msg] ?? 400).json({ error: msg || 'invalid_input' });
  }
});

pollsRouter.post('/polls/:id/vote', requireAuth, async (req, res) => {
  const id = parseMongoId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }

  try {
    const ballot = await castVote(req.auth!.sub, id, req.body);
    if (ballot === null) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(201).json(ballot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'vote_failed';
    if (msg === 'poll_closed') res.status(409).json({ error: msg });
    else if (msg === 'already_voted') res.status(409).json({ error: msg });
    else if (msg === 'invalid_body' || msg === 'invalid_choice') res.status(400).json({ error: msg });
    else throw err;
  }
});
