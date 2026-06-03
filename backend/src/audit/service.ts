import type { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export async function writeAuditLog(input: {
  userId?: string | null;
  action: AuditAction;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null | undefined;
}): Promise<void> {
  const data: Prisma.AuditLogCreateInput = {
    action: input.action,
    ipAddress: input.ipAddress ?? null,
    ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
  await prisma.auditLog.create({ data });
}
