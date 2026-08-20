import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser, Role } from './types.js';

const SECRET = process.env.JWT_SECRET ?? '';
if (!SECRET) {
  throw new Error('JWT_SECRET is not set. See .env.example.');
}
const EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];

export function signToken(user: AuthUser): string {
  return jwt.sign(user, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, SECRET) as AuthUser & jwt.JwtPayload;
  const { iat: _iat, exp: _exp, nbf: _nbf, ...user } = payload;
  return user as AuthUser;
}

/** Read the AuthUser off `req` (set by requireAuth). Throws if missing. */
export function currentUser(req: Request): AuthUser {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u) throw new HttpError(401, 'অ্যাক্সেস প্রত্যাখ্যাত।');
  return u;
}

/** Express middleware: require a valid Bearer token; attach user to req.user. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.header('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'ইমেইল বা পাসওয়ার্ড ভুল।' });
    return;
  }
  try {
    const user = verifyToken(match[1]);
    (req as Request & { user: AuthUser }).user = user;
    next();
  } catch {
    res.status(401).json({ error: 'সেশন মেয়াদোত্তীর্ণ।' });
  }
}

/** Additional gate: user must have one of the allowed roles. */
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const u = (req as Request & { user?: AuthUser }).user;
    if (!u || !allowed.includes(u.role)) {
      res.status(403).json({ error: 'অনুমতি নেই।' });
      return;
    }
    next();
  };
}

/** Throw this from route handlers to short-circuit with a specific status. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
