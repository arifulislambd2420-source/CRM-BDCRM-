import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { prisma } from '../db.js';
import type { Role } from '../types.js';
import { asyncHandler, makeId, p } from '../utils.js';

function toPublicUser(row: {
  id: string; name: string; email: string; role: string;
  storeId: string | null; canEditOwnNotes: boolean;
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    storeId: row.storeId ?? undefined,
    canEditOwnNotes: row.canEditOwnNotes,
  };
}

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, storeId: true, canEditOwnNotes: true },
    });
    res.json(rows.map(toPublicUser));
  }),
);

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
    const canEditOwnNotes = b.canEditOwnNotes === true;
    if (!name || !email || !password) throw new HttpError(400, 'সব ফিল্ড পূরণ করুন।');
    if (role !== 'sub_admin' && role !== 'store_manager') {
      throw new HttpError(400, 'অবৈধ রোল।');
    }
    if (role === 'store_manager' && !storeId) {
      throw new HttpError(400, 'শাখা ম্যানেজারের শাখা লাগবে।');
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new HttpError(409, 'এই ইমেইল ইতিমধ্যে ব্যবহৃত।');
    }
    const created = await prisma.user.create({
      data: {
        id: makeId('user'),
        name, email,
        passwordHash: bcrypt.hashSync(password, 10),
        role, storeId, canEditOwnNotes,
      },
    });
    res.status(201).json(toPublicUser(created));
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const row = await prisma.user.findUnique({ where: { id: p(req.params.id) } });
    if (!row) throw new HttpError(404, 'ইউজার পাওয়া যায়নি।');
    const data: Record<string, unknown> = {};
    if (b.role !== undefined) {
      if (b.role !== 'sub_admin' && b.role !== 'store_manager') {
        throw new HttpError(400, 'রোল বদলানো যাবে না।');
      }
      if (row.role === 'admin') throw new HttpError(400, 'অ্যাডমিনের রোল বদলানো যাবে না।');
      data.role = b.role;
    }
    if (b.storeId !== undefined) data.storeId = b.storeId || null;
    if (b.canEditOwnNotes !== undefined) data.canEditOwnNotes = b.canEditOwnNotes === true;
    if (b.name !== undefined) data.name = String(b.name);
    if (b.password !== undefined && b.password !== '') {
      data.passwordHash = bcrypt.hashSync(String(b.password), 10);
    }
    const updated = await prisma.user.update({ where: { id: p(req.params.id) }, data });
    res.json(toPublicUser(updated));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await prisma.user.findUnique({ where: { id: p(req.params.id) } });
    if (!row) {
      res.status(204).end();
      return;
    }
    if (row.role === 'admin') throw new HttpError(400, 'অ্যাডমিন অ্যাকাউন্ট মোছা যাবে না।');
    await prisma.user.delete({ where: { id: p(req.params.id) } });
    res.status(204).end();
  }),
);

export default router;
