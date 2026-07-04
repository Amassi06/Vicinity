import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../auth/middleware.js';
import {
  createMessage,
  listRecentMessages,
  markConversationRead,
} from '../../messages/service.js';
import { canAccessConversation } from '../../messages/conversations.js';
import { emitNewChatMessage } from '../../realtime/socket-server.js';
import { registerModule } from '../../plugins/module-registry.js';

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
  if (!(await canAccessConversation(req.auth!.sub, parsed.data.cid))) {
    res.status(403).json({ error: 'forbidden' });
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
  if (!(await canAccessConversation(req.auth!.sub, parsed.data.cid))) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  try {
    const plain = await createMessage(req.auth!.sub, parsed.data.cid, req.body);
    emitNewChatMessage(parsed.data.cid, plain);
    res.status(201).json(plain);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    if (message === 'invalid_body' || message === 'empty_message') {
      res.status(400).json({ error: message });
      return;
    }
    throw err;
  }
});

messagesRouter.post('/conversations/:cid/read', requireAuth, async (req, res) => {
  const parsed = ConvParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_conversation_id' });
    return;
  }
  if (!(await canAccessConversation(req.auth!.sub, parsed.data.cid))) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  await markConversationRead(parsed.data.cid, req.auth!.sub);
  res.status(204).send();
});

registerModule({
  id: 'messages',
  description: 'Messagerie temps réel entre voisins (salon public + DM).',
  router: messagesRouter,
});
