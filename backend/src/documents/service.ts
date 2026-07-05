import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { DocumentModel, type DocumentEntity, type SignatureZone } from '../db/mongo/models/index.js';
import { verifyMfaForUser } from '../auth/service.js';
import { saveBuffer } from '../storage/index.js';
import type { SetZonesInput, SignatureZoneInput } from './schemas.js';

const MAX_FAILED_MFA_ATTEMPTS = 5;
const MFA_LOCKOUT_WINDOW_MS = 5 * 60 * 1000;

interface FailedAttemptWindow {
  count: number;
  windowStart: number;
}

const failedMfaAttempts = new Map<string, FailedAttemptWindow>();

function assertMfaNotRateLimited(userId: string): void {
  const entry = failedMfaAttempts.get(userId);
  if (!entry) return;
  if (Date.now() - entry.windowStart > MFA_LOCKOUT_WINDOW_MS) {
    failedMfaAttempts.delete(userId);
    return;
  }
  if (entry.count >= MAX_FAILED_MFA_ATTEMPTS) throw new Error('rate_limited');
}

function registerFailedMfaAttempt(userId: string): void {
  const now = Date.now();
  const entry = failedMfaAttempts.get(userId);
  if (!entry || now - entry.windowStart > MFA_LOCKOUT_WINDOW_MS) {
    failedMfaAttempts.set(userId, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

function clearFailedMfaAttempts(userId: string): void {
  failedMfaAttempts.delete(userId);
}

export function computeStatusAfterSigning(
  zones: Array<Pick<SignatureZone, 'required' | 'signedBy'>>,
): 'signed' | 'pending_signatures' {
  const allRequiredSigned = zones.filter((z) => z.required).every((z) => Boolean(z.signedBy));
  return allRequiredSigned ? 'signed' : 'pending_signatures';
}

export interface UploadInput {
  ownerId: string;
  title: string;
  buffer: Buffer;
  contentType: string;
}

export async function uploadDocument(input: UploadInput): Promise<DocumentEntity> {
  const stored = await saveBuffer(input.buffer);
  const document = await DocumentModel.create({
    ownerId: input.ownerId,
    title: input.title,
    storageKey: stored.storageKey,
    contentType: input.contentType,
    sha256: stored.sha256,
    status: 'draft',
    zones: [],
    participants: [input.ownerId],
  });
  return document;
}

export async function listDocumentsForUser(userId: string, limit = 50): Promise<DocumentEntity[]> {
  return DocumentModel.find({
    $or: [{ ownerId: userId }, { participants: userId }],
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .exec();
}

/**
 * Inbox : documents reçus à signer (l'utilisateur est participant, pas le
 * propriétaire, le document est en attente et il lui reste une zone requise
 * non signée). Alimente la section "reçus" et la cloche de notifications.
 */
export async function listInboxDocuments(userId: string, limit = 50): Promise<DocumentEntity[]> {
  const docs = await DocumentModel.find({
    status: 'pending_signatures',
    participants: userId,
    ownerId: { $ne: userId },
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .exec();
  return docs.filter((d) =>
    d.zones.some((z) => z.required && z.signedBy !== userId && !z.signedBy),
  );
}

export async function getDocument(
  id: string,
  userId: string,
): Promise<DocumentEntity | null> {
  const doc = await DocumentModel.findById(id);
  if (!doc) return null;
  if (doc.ownerId !== userId && !doc.participants.includes(userId)) {
    throw new Error('forbidden');
  }
  return doc;
}

export async function setZones(
  id: string,
  ownerId: string,
  input: SetZonesInput,
): Promise<DocumentEntity> {
  const existing = await DocumentModel.findById(id);
  if (!existing) throw new Error('not_found');
  if (existing.ownerId !== ownerId) throw new Error('forbidden');

  const zones = input.zones.map((z: SignatureZoneInput) => ({
    page: z.page,
    x: z.x,
    y: z.y,
    width: z.width,
    height: z.height,
    required: z.required,
    signedBy: null,
    signedAt: null,
    signatureHash: null,
  }));
  const participants = input.participants?.length
    ? Array.from(new Set([ownerId, ...input.participants]))
    : existing.participants;

  const updated = await DocumentModel.findOneAndUpdate(
    { _id: id, ownerId, status: 'draft' },
    { $set: { zones, participants, status: 'pending_signatures' } },
    { new: true },
  );
  if (!updated) throw new Error('invalid_state');
  return updated;
}

export interface SignZoneInput {
  /** Dessin manuscrit de la signature, en data URL PNG (canvas). */
  signatureImage: string;
  /** Code TOTP — requis seulement si l'utilisateur a activé le MFA. */
  mfaToken?: string;
}

/** Décode une data URL PNG en buffer, en validant le format. */
function decodeSignatureImage(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) throw new Error('invalid_signature_image');
  const buffer = Buffer.from(match[1]!, 'base64');
  if (buffer.length === 0 || buffer.length > 500_000) throw new Error('invalid_signature_image');
  return buffer;
}

/**
 * Signe une zone avec une signature MANUSCRITE (dessin canvas) :
 *  - L'utilisateur doit être participant.
 *  - Le dessin de la signature est obligatoire ; il est stocké et son empreinte
 *    entre dans le hash de signature.
 *  - MFA : conservé comme second facteur si l'utilisateur l'a activé (exigence
 *    RGPD "MFA pour la signature"). Sans MFA activé, le dessin suffit.
 *  - signatureHash = sha256(documentSha256 || userId || zoneIndex || ISO || sha256(image))
 *  - Si toutes les zones requises sont signées, le doc passe en "signed".
 *  - Audit log RGPD : SIGN_DOCUMENT.
 */
export async function signZone(
  id: string,
  zoneIndex: number,
  userId: string,
  input: SignZoneInput,
): Promise<DocumentEntity> {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new Error('not_found');
  if (!doc.participants.includes(userId)) throw new Error('forbidden');
  if (doc.status !== 'pending_signatures') throw new Error('invalid_state');
  const zone = doc.zones[zoneIndex];
  if (!zone) throw new Error('invalid_zone');
  if (zone.signedBy) throw new Error('already_signed');

  const imageBuffer = decodeSignatureImage(input.signatureImage);

  // MFA en second facteur, uniquement pour les comptes qui l'ont activé.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true },
  });
  if (user?.mfaEnabled) {
    assertMfaNotRateLimited(userId);
    const mfaOk = await verifyMfaForUser(userId, input.mfaToken ?? '');
    if (!mfaOk) {
      registerFailedMfaAttempt(userId);
      throw new Error('mfa_required');
    }
    clearFailedMfaAttempts(userId);
  }

  const stored = await saveBuffer(imageBuffer);
  const signatureImageKey = stored.storageKey;
  const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

  const signedAt = new Date();
  const signatureHash = crypto
    .createHash('sha256')
    .update(`${doc.sha256}|${userId}|${zoneIndex}|${signedAt.toISOString()}|${imageHash}`)
    .digest('hex');

  const updated = await DocumentModel.findOneAndUpdate(
    {
      _id: id,
      status: 'pending_signatures',
      $expr: { $eq: [{ $arrayElemAt: ['$zones.signedBy', zoneIndex] }, null] },
    },
    [
      {
        $set: {
          zones: {
            $concatArrays: [
              { $slice: ['$zones', zoneIndex] },
              [
                {
                  $mergeObjects: [
                    { $arrayElemAt: ['$zones', zoneIndex] },
                    { signedBy: userId, signedAt, signatureHash, signatureImageKey },
                  ],
                },
              ],
              { $slice: ['$zones', zoneIndex + 1, { $size: '$zones' }] },
            ],
          },
        },
      },
    ],
    { new: true },
  );
  if (!updated) throw new Error('already_signed');

  if (computeStatusAfterSigning(updated.zones) === 'signed') {
    await DocumentModel.updateOne(
      { _id: id, status: 'pending_signatures' },
      { $set: { status: 'signed' } },
    );
    updated.status = 'signed';
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'SIGN_DOCUMENT',
      metadata: {
        documentId: String(doc._id),
        zoneIndex,
        signatureHash,
      },
    },
  });

  return updated;
}

/**
 * Renvoie la clé de stockage du dessin de signature d'une zone, après contrôle
 * d'accès (propriétaire ou participant). Utilisé pour afficher la signature.
 */
export async function getSignatureImageKey(
  id: string,
  zoneIndex: number,
  userId: string,
): Promise<string | null> {
  const doc = await DocumentModel.findById(id).lean();
  if (!doc) throw new Error('not_found');
  if (doc.ownerId !== userId && !doc.participants.includes(userId)) {
    throw new Error('forbidden');
  }
  const zone = doc.zones[zoneIndex];
  if (!zone) throw new Error('invalid_zone');
  return zone.signatureImageKey ?? null;
}
