import { Router } from 'express';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { db } from '../db.js';
import { asyncHandler, makeId } from '../utils.js';

interface StoreRow { id: string; name: string }

/** Denormalize each store with the list of userIds assigned to it as store_manager. */
function shape() {
  const stores = db.prepare(`SELECT id, name FROM stores`).all() as StoreRow[];
  const mgrs = db.prepare(
    `SELECT id AS user_id, store_id FROM users WHERE role = 'store_manager' AND store_id IS NOT NULL`,
  ).all() as { user_id: string; store_id: string }[];
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    managerIds: mgrs.filter((m) => m.store_id === s.id).map((m) => m.user_id),
  }));
}

const router = Router();
router.use(requireAuth);
router.get('/', (_req, res) => res.json(shape()));

router.use(requireRole('admin'));

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    const id = makeId('store');
    db.prepare(`INSERT INTO stores (id, name) VALUES (?, ?)`).run(id, name);
    res.status(201).json({ id, name, managerIds: [] });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    db.prepare(`UPDATE stores SET name = ? WHERE id = ?`).run(name, req.params.id);
    res.json({ ok: true });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    db.prepare(`DELETE FROM stores WHERE id = ?`).run(req.params.id);
    res.status(204).end();
  }),
);

export default router;
