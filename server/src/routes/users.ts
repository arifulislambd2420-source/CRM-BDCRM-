import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { db } from '../db.js';
import type { Role } from '../types.js';
import { asyncHandler, makeId } from '../utils.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  store_id: string | null;
  can_edit_own_notes: number;
}

function toPublicUser(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    storeId: row.store_id ?? undefined,
    canEditOwnNotes: row.can_edit_own_notes === 1,
  };
}

const router = Router();
router.use(requireAuth);

/** Any authenticated user can read the roster; only admin can mutate. */
router.get('/', (_req, res) => {
  const rows = db
    .prepare(`SELECT id, name, email, role, store_id, can_edit_own_notes FROM users`)
    .all() as UserRow[];
  res.json(rows.map(toPublicUser));
});

router.use(requireRole('admin'));

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const name = String(b.name ?? '').trim();
    const email = String(b.email ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const role = b.role as Role;
    const storeId = b.storeId ? String(b.storeId) : null;
    const canEditOwnNotes = b.canEditOwnNotes === true ? 1 : 0;
    if (!name || !email || !password) throw new HttpError(400, 'সব ফিল্ড পূরণ করুন।');
    if (role !== 'sub_admin' && role !== 'store_manager') {
      throw new HttpError(400, 'অবৈধ রোল।');
    }
    if (role === 'store_manager' && !storeId) {
      throw new HttpError(400, 'শাখা ম্যানেজারের শাখা লাগবে।');
    }
    if ((db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email) as unknown)) {
      throw new HttpError(409, 'এই ইমেইল ইতিমধ্যে ব্যবহৃত।');
    }
    const id = makeId('user');
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, store_id, can_edit_own_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, email, bcrypt.hashSync(password, 10), role, storeId, canEditOwnNotes);
    const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow;
    res.status(201).json(toPublicUser(row));
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id) as
      | UserRow
      | undefined;
    if (!row) throw new HttpError(404, 'ইউজার পাওয়া যায়নি।');
    const fields: Array<[string, unknown]> = [];
    if (b.role !== undefined) {
      if (b.role !== 'sub_admin' && b.role !== 'store_manager') {
        throw new HttpError(400, 'রোল বদলানো যাবে না।');
      }
      if (row.role === 'admin') {
        throw new HttpError(400, 'অ্যাডমিনের রোল বদলানো যাবে না।');
      }
      fields.push(['role', b.role]);
    }
    if (b.storeId !== undefined) fields.push(['store_id', b.storeId || null]);
    if (b.canEditOwnNotes !== undefined) {
      fields.push(['can_edit_own_notes', b.canEditOwnNotes === true ? 1 : 0]);
    }
    if (b.name !== undefined) fields.push(['name', String(b.name)]);
    if (b.password !== undefined && b.password !== '') {
      fields.push(['password_hash', bcrypt.hashSync(String(b.password), 10)]);
    }
    if (fields.length > 0) {
      const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(
        ...fields.map(([, v]) => v),
        req.params.id,
      );
    }
    const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id) as UserRow;
    res.json(toPublicUser(updated));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id) as
      | UserRow
      | undefined;
    if (!row) {
      res.status(204).end();
      return;
    }
    if (row.role === 'admin') {
      throw new HttpError(400, 'অ্যাডমিন অ্যাকাউন্ট মোছা যাবে না।');
    }
    db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
    res.status(204).end();
  }),
);

export default router;
