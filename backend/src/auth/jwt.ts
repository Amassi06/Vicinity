import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type Role = 'HABITANT' | 'MODERATOR' | 'ADMIN';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  mfa: boolean;
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  typ: 'refresh';
}

type SignOpts = {
  issuer: string;
  expiresIn: string;
  algorithm: 'HS256';
};

export function signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
  const opts: SignOpts = {
    issuer: env.JWT_ISSUER,
    expiresIn: env.JWT_ACCESS_TTL,
    algorithm: 'HS256',
  };
  return jwt.sign({ ...payload, typ: 'access' }, env.JWT_ACCESS_SECRET, opts as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'typ'>): string {
  const opts: SignOpts = {
    issuer: env.JWT_ISSUER,
    expiresIn: env.JWT_REFRESH_TTL,
    algorithm: 'HS256',
  };
  return jwt.sign({ ...payload, typ: 'refresh' }, env.JWT_REFRESH_SECRET, opts as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: env.JWT_ISSUER,
    algorithms: ['HS256'],
  }) as AccessTokenPayload;
  if (decoded.typ !== 'access') {
    throw new Error('wrong token type');
  }
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: env.JWT_ISSUER,
    algorithms: ['HS256'],
  }) as RefreshTokenPayload;
  if (decoded.typ !== 'refresh') {
    throw new Error('wrong token type');
  }
  return decoded;
}
