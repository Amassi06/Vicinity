import type { PointTxReason } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export interface TransferInput {
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason: PointTxReason;
  listingId?: string;
  contractId?: string;
}

export interface CreditInput {
  toUserId: string;
  amount: number;
  reason: PointTxReason;
  listingId?: string;
  contractId?: string;
}

export interface WalletSummary {
  balance: number;
  recent: Array<{
    id: string;
    direction: 'CREDIT' | 'DEBIT';
    amount: number;
    reason: PointTxReason;
    listingId: string | null;
    contractId: string | null;
    counterpartyId: string | null;
    createdAt: Date;
  }>;
}

/**
 * Transfère `amount` points de `fromUserId` vers `toUserId` en une seule
 * transaction SQL. Lève `insufficient_funds` si le solde est trop faible.
 * L'opération est atomique : soit les deux soldes sont mis à jour et la
 * transaction tracée, soit rien.
 */
export async function transferPoints(input: TransferInput): Promise<void> {
  if (input.amount <= 0) throw new Error('invalid_amount');
  if (input.fromUserId === input.toUserId) throw new Error('same_account');

  await prisma.$transaction(async (tx) => {
    const debit = await tx.user.updateMany({
      where: { id: input.fromUserId, pointsBalance: { gte: input.amount } },
      data: { pointsBalance: { decrement: input.amount } },
    });
    if (debit.count === 0) throw new Error('insufficient_funds');

    const credit = await tx.user.updateMany({
      where: { id: input.toUserId },
      data: { pointsBalance: { increment: input.amount } },
    });
    if (credit.count === 0) throw new Error('recipient_not_found');

    await tx.pointTransaction.create({
      data: {
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        amount: input.amount,
        reason: input.reason,
        listingId: input.listingId ?? null,
        contractId: input.contractId ?? null,
      },
    });
  });
}

/**
 * Crédite `toUserId` sans débiter d'utilisateur (bonus, ajustement admin).
 * `fromUserId` reste NULL côté audit.
 */
export async function creditPoints(input: CreditInput): Promise<void> {
  if (input.amount <= 0) throw new Error('invalid_amount');

  await prisma.$transaction(async (tx) => {
    const credit = await tx.user.updateMany({
      where: { id: input.toUserId },
      data: { pointsBalance: { increment: input.amount } },
    });
    if (credit.count === 0) throw new Error('recipient_not_found');

    await tx.pointTransaction.create({
      data: {
        fromUserId: null,
        toUserId: input.toUserId,
        amount: input.amount,
        reason: input.reason,
        listingId: input.listingId ?? null,
        contractId: input.contractId ?? null,
      },
    });
  });
}

export async function getWallet(userId: string): Promise<WalletSummary> {
  const [user, txs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } }),
    prisma.pointTransaction.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);
  if (!user) throw new Error('user_not_found');

  return {
    balance: user.pointsBalance,
    recent: txs.map((t) => {
      const direction: 'CREDIT' | 'DEBIT' = t.toUserId === userId ? 'CREDIT' : 'DEBIT';
      const counterpartyId =
        direction === 'CREDIT' ? t.fromUserId ?? null : t.toUserId ?? null;
      return {
        id: t.id,
        direction,
        amount: t.amount,
        reason: t.reason,
        listingId: t.listingId,
        contractId: t.contractId,
        counterpartyId,
        createdAt: t.createdAt,
      };
    }),
  };
}

// ----------------------------------------------------------------------------
// Séquestre ("coffre-fort") : les points du payeur sont débités à la signature
// du contrat par les deux parties, sans être crédités à personne, puis versés
// au prestataire à la finalisation (ou rendus au payeur à l'annulation). Le
// solde sous séquestre d'un contrat se déduit du journal des transactions.
// ----------------------------------------------------------------------------

export interface EscrowInput {
  payerId: string;
  payeeId: string;
  amount: number;
  listingId?: string;
  contractId: string;
}

/** Débite le payeur vers le séquestre. Lève `insufficient_funds` si solde trop faible. */
export async function escrowDeposit(input: EscrowInput): Promise<void> {
  if (input.amount <= 0) throw new Error('invalid_amount');

  await prisma.$transaction(async (tx) => {
    const debit = await tx.user.updateMany({
      where: { id: input.payerId, pointsBalance: { gte: input.amount } },
      data: { pointsBalance: { decrement: input.amount } },
    });
    if (debit.count === 0) throw new Error('insufficient_funds');

    await tx.pointTransaction.create({
      data: {
        fromUserId: input.payerId,
        toUserId: null,
        amount: input.amount,
        reason: 'ESCROW_DEPOSIT',
        listingId: input.listingId ?? null,
        contractId: input.contractId,
      },
    });
  });
}

/** Verse le séquestre au prestataire (fin de contrat réussie). */
export async function escrowRelease(input: EscrowInput): Promise<void> {
  if (input.amount <= 0) throw new Error('invalid_amount');

  await prisma.$transaction(async (tx) => {
    const credit = await tx.user.updateMany({
      where: { id: input.payeeId },
      data: { pointsBalance: { increment: input.amount } },
    });
    if (credit.count === 0) throw new Error('recipient_not_found');

    await tx.pointTransaction.create({
      data: {
        fromUserId: null,
        toUserId: input.payeeId,
        amount: input.amount,
        reason: 'ESCROW_RELEASE',
        listingId: input.listingId ?? null,
        contractId: input.contractId,
      },
    });
  });
}

/** Rend le séquestre au payeur (contrat annulé). */
export async function escrowRefund(input: EscrowInput): Promise<void> {
  if (input.amount <= 0) throw new Error('invalid_amount');

  await prisma.$transaction(async (tx) => {
    const credit = await tx.user.updateMany({
      where: { id: input.payerId },
      data: { pointsBalance: { increment: input.amount } },
    });
    if (credit.count === 0) throw new Error('recipient_not_found');

    await tx.pointTransaction.create({
      data: {
        fromUserId: null,
        toUserId: input.payerId,
        amount: input.amount,
        reason: 'ESCROW_REFUND',
        listingId: input.listingId ?? null,
        contractId: input.contractId,
      },
    });
  });
}

/** Solde d'un utilisateur, pour les contrôles applicatifs de solvabilité. */
export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pointsBalance: true },
  });
  if (!user) throw new Error('user_not_found');
  return user.pointsBalance;
}
