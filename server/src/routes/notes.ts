import { Router } from 'express';
import { HttpError, currentUser, requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import type { AuthUser } from '../types.js';
import { asyncHandler, makeId, p } from '../utils.js';

interface NoteRow {
  id: string;
  createdById: string;
  createdByName: string;
  number: number;
  text: string;
  createdAt: Date;
}

/** Server-side twin of frontend canModifyNote — the source of truth. */
function canModifyNote(user: AuthUser, note: NoteRow): boolean {
  if (user.role === 'admin') return true;
  if (note.createdById !== user.id) return false;
  return user.canEditOwnNotes === true;
}

async function assertVisibleCustomer(user: AuthUser, customerId: string) {
  const row = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, storeId: true },
  });
  if (!row) throw new HttpError(404, 'কাস্টমার পাওয়া যায়নি।');
  if (user.role === 'store_manager' && row.storeId !== user.storeId) {
    throw new HttpError(403, 'অনুমতি নেই।');
  }
  return row;
}

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const customerId = String(req.params.customerId ?? '');
    await assertVisibleCustomer(u, customerId);
    const text = String(req.body?.text ?? '').trim();
    if (!text) throw new HttpError(400, 'নোট খালি রাখা যাবে না।');

    // Sequential per-customer, max+1 so numbers never recycle.
    const agg = await prisma.note.aggregate({
      _max: { number: true },
      where: { customerId },
    });
    const number = (agg._max.number ?? 0) + 1;
    const created = await prisma.note.create({
      data: {
        id: makeId('note'),
        customerId,
        number,
        text,
        createdAt: new Date(),
        createdById: u.id,
        createdByName: u.name,
      },
    });
    res.status(201).json({
      id: created.id,
      number: created.number,
      text: created.text,
      createdAt: created.createdAt.toISOString(),
      createdById: created.createdById,
      createdByName: created.createdByName,
    });
  }),
);

router.patch(
  '/:noteId',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const customerId = String(req.params.customerId ?? '');
    await assertVisibleCustomer(u, customerId);
    const note = await prisma.note.findFirst({
      where: { id: p(req.params.noteId), customerId },
    });
    if (!note) throw new HttpError(404, 'নোট পাওয়া যায়নি।');
    if (!canModifyNote(u, note)) throw new HttpError(403, 'এই নোট সম্পাদনার অনুমতি নেই।');
    const text = String(req.body?.text ?? '').trim();
    if (!text) throw new HttpError(400, 'নোট খালি রাখা যাবে না।');
    const updated = await prisma.note.update({ where: { id: note.id }, data: { text } });
    res.json({
      id: updated.id,
      number: updated.number,
      text: updated.text,
      createdAt: updated.createdAt.toISOString(),
      createdById: updated.createdById,
      createdByName: updated.createdByName,
    });
  }),
);

router.delete(
  '/:noteId',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const customerId = String(req.params.customerId ?? '');
    await assertVisibleCustomer(u, customerId);
    const note = await prisma.note.findFirst({
      where: { id: p(req.params.noteId), customerId },
    });
    if (!note) {
      res.status(204).end();
      return;
    }
    if (!canModifyNote(u, note)) throw new HttpError(403, 'এই নোট মোছার অনুমতি নেই।');
    await prisma.note.delete({ where: { id: note.id } });
    res.status(204).end();
  }),
);

export default router;
