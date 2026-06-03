import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type AccessTokenPayload, type Role } from './jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AccessTokenPayload;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  try {
    req.auth = verifyAccessToken(header.slice('Bearer '.length));
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: 'forbidden', required: roles });
      return;
    }
    next();
  };
}
