import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { DocumentModel, type DocumentEntity } from '../db/mongo/models/index.js';
import { verifyMfaForUser } from '../auth/service.js';
import { saveBuffer } from '../storage/index.js';
import type { SetZonesInput, SignatureZoneInput } from './schemas.js';

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
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new Error('not_found');
  if (doc.ownerId !== ownerId) throw new Error('forbidden');
  if (doc.status !== 'draft') throw new Error('invalid_state');

  doc.zones = input.zones.map((z: SignatureZoneInput) => ({
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
  if (input.participants?.length) {
    const merged = new Set([ownerId, ...input.participants]);
    doc.participants = Array.from(merged);
  }
  doc.status = 'pending_signatures';
  await doc.save();
  return doc;
}

/**
 * Signe une zone :
 *  - L'utilisateur doit être participant.
 *  - MFA OBLIGATOIRE : on vérifie le TOTP avant d'inscrire la signature.
 *  - signatureHash = sha256(documentSha256 || userId || zoneIndex || ISO timestamp)
 *    → trace cryptographique du couple (document, signataire, zone, instant).
 *  - Si toutes les zones requises sont signées, le doc passe en "signed".
 *  - Audit log RGPD : SIGN_DOCUMENT.
 */
export async function signZone(
  id: string,
  zoneIndex: number,
  userId: string,
  token: string,
): Promise<DocumentEntity> {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new Error('not_found');
  if (!doc.participants.includes(userId)) throw new Error('forbidden');
  if (doc.status !== 'pending_signatures') throw new Error('invalid_state');
  const zone = doc.zones[zoneIndex];
  if (!zone) throw new Error('invalid_zone');
  if (zone.signedBy) throw new Error('already_signed');

  const mfaOk = await verifyMfaForUser(userId, token);
  if (!mfaOk) throw new Error('mfa_required');

  const signedAt = new Date();
  const signatureHash = crypto
    .createHash('sha256')
    .update(`${doc.sha256}|${userId}|${zoneIndex}|${signedAt.toISOString()}`)
    .digest('hex');

  zone.signedBy = userId;
  zone.signedAt = signedAt;
  zone.signatureHash = signatureHash;
  doc.markModified('zones');

  const allRequiredSigned = doc.zones
    .filter((z) => z.required)
    .every((z) => Boolean(z.signedBy));
  if (allRequiredSigned) {
    doc.status = 'signed';
  }
  await doc.save();

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

  return doc;
}
