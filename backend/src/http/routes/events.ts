import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import {
  EventsListQuerySchema,
  EventCreateSchema,
} from '../../events/schemas.js';
import {
  cancelEvent,
  createEventOrganizer,
  declineEvent,
  expressInterest,
  getRecommendations,
  listPublishedEvents,
  publishEvent,
} from '../../events/service.js';

export const eventsRouter = Router();

const IdParam = z.object({ id: z.string().min(1) });

function parseId(req: Request): string | null {
  const parsed = IdParam.safeParse(req.params);
  return parsed.success ? parsed.data.id : null;
}

eventsRouter.get('/events', requireAuth, async (req, res) => {
  const parsed = EventsListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', issues: parsed.error.issues });
    return;
  }
  const items = await listPublishedEvents(parsed.data.neighbourhoodId);
  res.json({ items });
});

eventsRouter.get('/events/recommendations', requireAuth, async (req, res) => {
  const q = z
    .object({ neighbourhoodId: z.string().uuid() })
    .safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: 'invalid_query', issues: q.error.issues });
    return;
  }
  const items = await getRecommendations(req.auth!.sub, q.data.neighbourhoodId);
  res.json({ items });
});

eventsRouter.post('/events', requireAuth, async (req, res) => {
  const parsed = EventCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    return;
  }
  if (parsed.data.endsAt <= parsed.data.startsAt) {
    res.status(400).json({ error: 'invalid_dates' });
    return;
  }

  try {
    const doc = await createEventOrganizer(req.auth!.sub, parsed.data);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'create_failed',
    });
  }
});

eventsRouter.post('/events/:id/publish', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const doc = await publishEvent(id, req.auth!.sub);
    if (!doc) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(doc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'publish_failed';
    res.status(msg === 'forbidden' ? 403 : 400).json({ error: msg });
  }
});

eventsRouter.post('/events/:id/cancel', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const doc = await cancelEvent(id, req.auth!.sub);
    if (!doc) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(doc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'cancel_failed';
    res.status(msg === 'forbidden' ? 403 : 400).json({ error: msg });
  }
});

eventsRouter.post('/events/:id/interest', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const doc = await expressInterest(id, req.auth!.sub);
    if (!doc) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(doc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'interest_failed';
    res.status(400).json({ error: msg });
  }
});

eventsRouter.post('/events/:id/decline', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const doc = await declineEvent(id, req.auth!.sub);
    if (!doc) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(doc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'decline_failed';
    res.status(400).json({ error: msg });
  }
});
