import { Router } from 'express';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler, makeId, p } from '../utils.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const stores = await prisma.store.findMany({
      include: {
        managers: {
          where: { role: 'store_manager' },
          select: { id: true },
        },
      },
    });
    res.json(
      stores.map((s) => ({
        id: s.id,
        name: s.name,
        managerIds: s.managers.map((m) => m.id),
      })),
    );
  }),
);

router.use(requireRole('admin'));

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    const created = await prisma.store.create({ data: { id: makeId('store'), name } });
    res.status(201).json({ id: created.id, name: created.name, managerIds: [] });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    await prisma.store.update({ where: { id: p(req.params.id) }, data: { name } });
    res.json({ ok: true });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.store.delete({ where: { id: p(req.params.id) } }).catch(() => {
      // ignore not-found — deleting non-existent store is idempotent
    });
    res.status(204).end();
  }),
);

export default router;
