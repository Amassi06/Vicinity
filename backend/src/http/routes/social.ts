import { Router } from 'express';
import { requireAuth } from '../../auth/middleware.js';
import { prisma } from '../../db/prisma.js';
import { DocumentModel } from '../../db/mongo/models/index.js';
import {
  countUnreadMessages,
  listDmPartnerIds,
} from '../../messages/service.js';
import { dmRoomId, publicRoomId } from '../../messages/conversations.js';
import { isUserOnline } from '../../realtime/socket-server.js';
import { registerModule } from '../../plugins/module-registry.js';

export const socialRouter = Router();

/**
 * Habitants (non-staff) du quartier de l'utilisateur connecté, avec statut de
 * présence temps réel. Sert à alimenter la sidebar droite et à ouvrir un DM.
 */
socialRouter.get('/me/neighbours', requireAuth, async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    select: { neighbourhoodId: true },
  });
  if (!me?.neighbourhoodId) {
    res.json({ items: [] });
    return;
  }
  const rows = await prisma.user.findMany({
    where: {
      neighbourhoodId: me.neighbourhoodId,
      role: 'HABITANT',
      status: 'ACTIVE',
      id: { not: req.auth!.sub },
    },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
  });
  res.json({
    items: rows.map((u) => ({ ...u, online: isUserOnline(u.id) })),
  });
});

/**
 * Compteurs de non-lus pour la bulle de notifications : messages (salon public
 * du quartier + tous mes DM) et documents en attente de ma signature.
 */
socialRouter.get('/me/notifications', requireAuth, async (req, res) => {
  const userId = req.auth!.sub;
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { neighbourhoodId: true },
  });

  const conversationIds: string[] = [];
  if (me?.neighbourhoodId) conversationIds.push(publicRoomId(me.neighbourhoodId));
  const partners = await listDmPartnerIds(userId);
  for (const partnerId of partners) conversationIds.push(dmRoomId(userId, partnerId));

  const messages = await countUnreadMessages(userId, conversationIds);

  // Documents où je suis participant, en attente de signatures, et dont il me
  // reste une zone non signée.
  const pendingDocs = await DocumentModel.find(
    { participants: userId, status: 'pending_signatures' },
    { zones: 1 },
  ).lean();
  const documents = pendingDocs.filter((doc) =>
    (doc.zones ?? []).some((z) => z.required && z.signedBy !== userId && !z.signedBy),
  ).length;

  res.json({ messages, documents, total: messages + documents });
});

registerModule({
  id: 'social',
  description: 'Liste des habitants du quartier et notifications de non-lus.',
  router: socialRouter,
});
