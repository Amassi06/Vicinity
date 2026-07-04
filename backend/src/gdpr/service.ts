import { prisma } from '../db/prisma.js';
import { writeAuditLog } from '../audit/service.js';
import { verifyMfaForUser } from '../auth/service.js';
import { DocumentModel } from '../db/mongo/models/document.model.js';
import { MessageModel } from '../db/mongo/models/message.model.js';
import { PollModel } from '../db/mongo/models/poll.model.js';
import { VoteModel } from '../db/mongo/models/vote.model.js';

const CONSENT_KEYS = ['marketing', 'analytics', 'neighbourhood_digest'] as const;
export type ConsentKey = (typeof CONSENT_KEYS)[number];

export type ConsentState = Record<ConsentKey, boolean>;

const consentStore = new Map<string, ConsentState>();

function defaultConsents(): ConsentState {
  return { marketing: false, analytics: false, neighbourhood_digest: true };
}

export function getConsents(userId: string): ConsentState {
  return consentStore.get(userId) ?? defaultConsents();
}

export async function updateConsents(
  userId: string,
  patch: Partial<ConsentState>,
  ipAddress?: string | null | undefined,
): Promise<ConsentState> {
  const current = getConsents(userId);
  const next = { ...current, ...patch };
  consentStore.set(userId, next);

  for (const key of CONSENT_KEYS) {
    if (patch[key] === undefined) continue;
    await writeAuditLog({
      userId,
      action: patch[key] ? 'CONSENT_GIVEN' : 'CONSENT_REVOKED',
      metadata: { key },
      ipAddress,
    });
  }

  return next;
}

export async function exportUserData(userId: string, ipAddress?: string | null | undefined) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      mfaEnabled: true,
      pointsBalance: true,
      neighbourhoodId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return null;

  const [sessions, audits, transactions, documents, votes] = await Promise.all([
    prisma.session.findMany({
      where: { userId },
      select: { id: true, expiresAt: true, revokedAt: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.pointTransaction.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    DocumentModel.find({
      $or: [{ ownerId: userId }, { participants: userId }],
    })
      .select('-__v')
      .lean(),
    VoteModel.find({ userId }).lean(),
  ]);

  const pollsCreated = await PollModel.find({ createdBy: userId }).lean();
  const messages = await MessageModel.find({ senderId: userId }).sort({ createdAt: -1 }).limit(200).lean();

  await writeAuditLog({
    userId,
    action: 'EXPORT_DATA',
    metadata: { format: 'json' },
    ipAddress,
  });

  return {
    exportedAt: new Date().toISOString(),
    user,
    consents: getConsents(userId),
    sessions,
    auditLogs: audits,
    pointTransactions: transactions,
    documents,
    pollsCreated,
    votes,
    messages,
  };
}

export interface ProfilePatch {
  displayName?: string;
  email?: string;
  neighbourhoodId?: string;
}

/**
 * Droit de rectification RGPD : le nom se modifie librement, l'e-mail
 * nécessite une vérification MFA (au même titre que la signature de document)
 * — mais uniquement pour les utilisateurs qui ont activé le MFA. Un compte
 * sans MFA n'a pas de second facteur à vérifier : `verifyMfaForUser` renvoie
 * toujours `false` pour lui, ce qui bloquerait à vie tout changement d'e-mail
 * si on l'exigeait quand même.
 */
export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
  mfaToken: string | undefined,
  ipAddress?: string | null | undefined,
): Promise<{ id: string; email: string; displayName: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('user_not_found');

  if (patch.email && patch.email !== user.email && user.mfaEnabled) {
    if (!mfaToken || !(await verifyMfaForUser(userId, mfaToken))) {
      throw new Error('mfa_required');
    }
  }

  if (patch.neighbourhoodId) {
    const neighbourhood = await prisma.neighbourhood.findUnique({
      where: { id: patch.neighbourhoodId },
      select: { id: true },
    });
    if (!neighbourhood) throw new Error('invalid_neighbourhood');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(patch.displayName ? { displayName: patch.displayName } : {}),
      ...(patch.email ? { email: patch.email } : {}),
      ...(patch.neighbourhoodId ? { neighbourhoodId: patch.neighbourhoodId } : {}),
    },
  });

  await writeAuditLog({
    userId,
    action: 'UPDATE_PROFILE',
    metadata: { fields: Object.keys(patch) },
    ipAddress,
  });

  return { id: updated.id, email: updated.email, displayName: updated.displayName };
}

export async function deleteUserAccount(
  userId: string,
  ipAddress?: string | null | undefined,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'DELETED') {
    throw new Error('user_not_found');
  }

  await writeAuditLog({
    userId,
    action: 'DELETE_ACCOUNT',
    metadata: { email: user.email },
    ipAddress,
  });

  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'DELETED',
      deletedAt: new Date(),
      email: `deleted+${userId}@vicinity.invalid`,
      displayName: 'Compte supprimé',
      passwordHash: '',
      mfaSecret: null,
      mfaEnabled: false,
    },
  });

  consentStore.delete(userId);
}
