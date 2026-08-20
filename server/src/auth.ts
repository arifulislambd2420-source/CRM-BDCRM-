import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';
import type { AuthUser, Role } from './types.js';

const ACCESS_SECRET = process.env.JWT_SECRET ?? '';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? '';
if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set. See .env.example.');
}
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as jwt.SignOptions['expiresIn'];

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(user, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, ACCESS_SECRET) as AuthUser & jwt.JwtPayload;
  const { iat: _i, exp: _e, nbf: _n, ...user } = payload;
  return user as AuthUser;
}

/**
 * Issue a refresh token and persist a HASH of it. The plain token only leaves
 * the server this once; we never store it. On refresh we look it up by hash.
 */
export async function issueRefreshToken(userId: string): Promise<string> {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ jti, uid: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  const tokenHash = hashToken(token);
  const decoded = jwt.decode(token) as { exp: number };
  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId,
      tokenHash,
      expiresAt: new Date(decoded.exp * 1000),
    },
  });
  return token;
}

/**
 * Rotate: verify the refresh token, revoke it, issue a new pair.
 * Returns null if the token is invalid, expired, or already revoked.
 */
export async function rotateRefreshToken(
  token: string,
): Promise<{ user: AuthUser; accessToken: string; refreshToken: string } | null> {
  let payload: { jti: string; uid: string } & jwt.JwtPayload;
  try {
    payload = jwt.verify(token, REFRESH_SECRET) as { jti: string; uid: string } & jwt.JwtPayload;
  } catch {
    return null;
  }
  const row = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!row || row.revokedAt || row.tokenHash !== hashToken(token)) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  const userRow = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!userRow) return null;

  // Revoke the old token, issue a fresh pair.
  await prisma.refreshToken.update({
    where: { id: payload.jti },
    data: { revokedAt: new Date() },
  });
  const user: AuthUser = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    role: userRow.role as Role,
    storeId: userRow.storeId ?? undefined,
    canEditOwnNotes: userRow.canEditOwnNotes,
  };
  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id),
  };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET) as { jti: string } & jwt.JwtPayload;
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Silently ignore — nothing to revoke.
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function currentUser(req: Request): AuthUser {
  const u = (req as Request & { user?: AuthUser }).user;
  if (!u) throw new HttpError(401, 'অ্যাক্সেস প্রত্যাখ্যাত।');
  return u;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'অথেন্টিকেশন প্রয়োজন।' });
    return;
  }
  try {
    const user = verifyAccessToken(match[1]);
    (req as Request & { user: AuthUser }).user = user;
    next();
  } catch {
    res.status(401).json({ error: 'সেশন মেয়াদোত্তীর্ণ।' });
  }
}

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

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
