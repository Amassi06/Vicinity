import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import { createMessage, listRecentMessages } from '../../messages/service.js';
import { emitNewChatMessage } from '../../realtime/socket-server.js';

export const messagesRouter = Router();

const ConvParamSchema = z.object({
  cid: z.string().min(8).max(120),
});

messagesRouter.get('/conversations/:cid/messages', requireAuth, async (req, res) => {
  const parsed = ConvParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_conversation_id' });
    return;
  }
  const msgs = await listRecentMessages(parsed.data.cid, 80);
  res.json({ items: msgs.reverse() });
});

messagesRouter.post('/conversations/:cid/messages', requireAuth, async (req, res) => {
  const parsed = ConvParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_conversation_id' });
    return;
  }
  try {
    const plain = await createMessage(req.auth!.sub, parsed.data.cid, req.body);
    emitNewChatMessage(parsed.data.cid, plain);
    res.status(201).json(plain);
  } catch (err) {
    if (err instanceof Error && err.message === 'invalid_body') {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});
