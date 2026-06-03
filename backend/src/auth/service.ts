import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { hashPassword, verifyPassword } from './password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt.js';
import type { Role } from './jwt.js';
import { generateMfaSecret, verifyTotp, type MfaEnrollment } from './totp.js';

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: { id: string; email: string; displayName: string; role: Role; mfaEnabled: boolean };
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshTtlMs(): number {
  return 7 * 24 * 60 * 60 * 1000;
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      status: 'ACTIVE',
    },
  });
  return issueTokens(user);
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === 'SUSPENDED' || user.status === 'DELETED') {
    throw new Error('invalid_credentials');
  }
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw new Error('invalid_credentials');
  return issueTokens(user);
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const decoded = verifyRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashRefreshToken(refreshToken) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new Error('invalid_session');
  }
  if (session.userId !== decoded.sub) {
    throw new Error('invalid_session');
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(session.user);
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

export async function logout(refreshToken: string): Promise<string | null> {
  const hash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hash },
    select: { userId: true, revokedAt: true },
  });
  await prisma.session.updateMany({
    where: { refreshTokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return session?.revokedAt ? null : (session?.userId ?? null);
}

export async function enrollMfa(userId: string): Promise<MfaEnrollment> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('user_not_found');
  const enrollment = generateMfaSecret(user.email);
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: enrollment.secret, mfaEnabled: false },
  });
  return enrollment;
}

export async function activateMfa(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaSecret) throw new Error('mfa_not_enrolled');
  if (!verifyTotp(token, user.mfaSecret)) throw new Error('invalid_totp');
  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
}

export async function disableMfa(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaEnabled || !user.mfaSecret) throw new Error('mfa_not_enabled');
  if (!verifyTotp(token, user.mfaSecret)) throw new Error('invalid_totp');
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null },
  });
}

export async function verifyMfaForUser(userId: string, token: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaEnabled || !user.mfaSecret) return false;
  return verifyTotp(token, user.mfaSecret);
}

/**
 * SSO : émet un access token court (5 min) consommable par le client desktop.
 * L'utilisateur doit déjà être authentifié sur le web (donc avoir un access token valide).
 */
export async function issueSsoToken(userId: string): Promise<{ ssoToken: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('user_not_found');
  const ssoToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    mfa: user.mfaEnabled,
  });
  return { ssoToken };
}

interface UserForToken {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  mfaEnabled: boolean;
}

async function issueTokens(user: UserForToken): Promise<AuthResult> {
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    mfa: user.mfaEnabled,
  });
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlMs()),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
    },
  };
}
