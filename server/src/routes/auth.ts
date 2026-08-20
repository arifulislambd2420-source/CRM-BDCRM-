import { Router } from 'express';
import {
  HttpError,
  currentUser,
  issueRefreshToken,
  requireAuth,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
} from '../auth.js';
import { prisma } from '../db.js';
import type { AuthUser, Role } from '../types.js';
import { asyncHandler } from '../utils.js';

const router = Router();

function toAuthUser(row: {
  id: string; name: string; email: string; role: string;
  storeId: string | null; canEditOwnNotes: boolean;
}): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    storeId: row.storeId ?? undefined,
    canEditOwnNotes: row.canEditOwnNotes,
  };
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new HttpError(400, 'ইমেইল ও পাসওয়ার্ড দিন।');
    }
    const row = await prisma.user.findFirst({
      where: { email: { equals: email } },
    });
    if (!row || !(await verifyPassword(password, row.passwordHash))) {
      throw new HttpError(401, 'ইমেইল বা পাসওয়ার্ড ভুল।');
    }
    const user = toAuthUser(row);
    res.json({
      user,
      accessToken: signAccessToken(user),
      refreshToken: await issueRefreshToken(user.id),
    });
  }),
);

/** Exchange a refresh token for a fresh access+refresh pair (rotation). */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (typeof refreshToken !== 'string') {
      throw new HttpError(400, 'refreshToken প্রয়োজন।');
    }
    const rotated = await rotateRefreshToken(refreshToken);
    if (!rotated) throw new HttpError(401, 'সেশন মেয়াদোত্তীর্ণ।');
    res.json(rotated);
  }),
);

/** Server-side revocation of the current refresh token. */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (typeof refreshToken === 'string') await revokeRefreshToken(refreshToken);
    res.status(204).end();
  }),
);

/** Confirm the access token still resolves to a real user. */
router.get(
  '/session',
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const fresh = await prisma.user.findUnique({ where: { id: u.id } });
    if (!fresh) {
      res.status(401).json({ error: 'সেশন অকেজো — ইউজার মুছে ফেলা হয়েছে।' });
      return;
    }
    res.json({ user: toAuthUser(fresh) });
  }),
);

export default router;
