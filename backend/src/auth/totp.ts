import { authenticator } from 'otplib';
import { env } from '../config/env.js';

authenticator.options = { window: 1, step: 30 };

export interface MfaEnrollment {
  secret: string;
  otpauthUri: string;
}

export function generateMfaSecret(email: string): MfaEnrollment {
  const secret = authenticator.generateSecret();
  const issuer = env.JWT_ISSUER;
  const otpauthUri = authenticator.keyuri(email, issuer, secret);
  return { secret, otpauthUri };
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
