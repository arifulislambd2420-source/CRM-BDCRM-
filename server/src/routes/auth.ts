import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { HttpError, currentUser, requireAuth, signToken } from '../auth.js';
import { db } from '../db.js';
import type { AuthUser, Role } from '../types.js';
import { asyncHandler } from '../utils.js';

const router = Router();

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  store_id: string | null;
  can_edit_own_notes: number;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    storeId: row.store_id ?? undefined,
    canEditOwnNotes: row.can_edit_own_notes === 1,
  };
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new HttpError(400, 'ইমেইল ও পাসওয়ার্ড দিন।');
    }
    const row = db
      .prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`)
      .get(email) as UserRow | undefined;
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      throw new HttpError(401, 'ইমেইল বা পাসওয়ার্ড ভুল।');
    }
    const user = toAuthUser(row);
    const token = signToken(user);
    res.json({ user, token });
  }),
);

/** Confirm the token still resolves to a real user (defense against a deleted-mid-session account). */
router.get('/session', requireAuth, (req, res) => {
  const u = currentUser(req);
  const fresh = db.prepare(`SELECT * FROM users WHERE id = ?`).get(u.id) as UserRow | undefined;
  if (!fresh) {
    res.status(401).json({ error: 'সেশন অকেজো — ইউজার মুছে ফেলা হয়েছে।' });
    return;
  }
  res.json({ user: toAuthUser(fresh) });
});

export default router;
