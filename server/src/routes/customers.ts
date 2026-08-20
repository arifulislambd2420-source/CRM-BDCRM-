import { Router } from 'express';
import { HttpError, currentUser, requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import type { Customer, Note } from '../types.js';
import { asyncHandler, makeId, p } from '../utils.js';

type PrismaCustomer = Awaited<ReturnType<typeof prisma.customer.findFirst>>;
type NoteRow = { id: string; number: number; text: string; createdAt: Date; createdById: string; createdByName: string };

function toApiCustomer(
  row: NonNullable<PrismaCustomer>,
  notes: NoteRow[],
): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    source: row.source,
    pipelineId: row.pipelineId,
    currentStageId: row.currentStageId,
    storeId: row.storeId,
    createdAt: row.createdAt.toISOString(),
    createdById: row.createdById,
    notes: notes.map(toApiNote),
  };
}
function toApiNote(n: NoteRow): Note {
  return {
    id: n.id,
    number: n.number,
    text: n.text,
    createdAt: n.createdAt.toISOString(),
    createdById: n.createdById,
    createdByName: n.createdByName,
  };
}

const router = Router();
router.use(requireAuth);

/** GET /api/customers — role-scoped list; store managers see only their own store. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const where = u.role === 'store_manager' ? { storeId: u.storeId } : {};
    const rows = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { notes: { orderBy: { number: 'asc' } } },
    });
    res.json(rows.map((r) => toApiCustomer(r, r.notes)));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const row = await prisma.customer.findUnique({
      where: { id: p(req.params.id) },
      include: { notes: { orderBy: { number: 'asc' } } },
    });
    if (!row) throw new HttpError(404, 'কাস্টমার পাওয়া যায়নি।');
    if (u.role === 'store_manager' && row.storeId !== u.storeId) {
      throw new HttpError(403, 'অনুমতি নেই।');
    }
    res.json(toApiCustomer(row, row.notes));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const b = req.body ?? {};
    const storeId =
      u.role === 'store_manager' && u.storeId ? u.storeId : String(b.storeId ?? '');
    if (!b.name || !b.phone || !storeId || !b.pipelineId || !b.currentStageId) {
      throw new HttpError(400, 'সব আবশ্যক ফিল্ড পূরণ করুন।');
    }
    const created = await prisma.customer.create({
      data: {
        id: makeId('cust'),
        name: String(b.name),
        phone: String(b.phone),
        address: String(b.address ?? ''),
        source: String(b.source ?? ''),
        pipelineId: String(b.pipelineId),
        currentStageId: String(b.currentStageId),
        storeId,
        createdAt: new Date(),
        createdById: u.id,
      },
    });
    res.status(201).json(toApiCustomer(created, []));
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const row = await prisma.customer.findUnique({ where: { id: p(req.params.id) } });
    if (!row) throw new HttpError(404, 'কাস্টমার পাওয়া যায়নি।');
    if (u.role === 'store_manager' && row.storeId !== u.storeId) {
      throw new HttpError(403, 'আপনার এই কাস্টমার সম্পাদনার অনুমতি নেই।');
    }
    const b = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = String(b.name);
    if (b.phone !== undefined) data.phone = String(b.phone);
    if (b.address !== undefined) data.address = String(b.address);
    if (b.source !== undefined) data.source = String(b.source);
    if (b.pipelineId !== undefined) data.pipelineId = String(b.pipelineId);
    if (b.currentStageId !== undefined) data.currentStageId = String(b.currentStageId);
    if (b.storeId !== undefined && u.role !== 'store_manager') {
      data.storeId = String(b.storeId);
    }
    const updated = await prisma.customer.update({
      where: { id: p(req.params.id) },
      data,
      include: { notes: { orderBy: { number: 'asc' } } },
    });
    res.json(toApiCustomer(updated, updated.notes));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const row = await prisma.customer.findUnique({ where: { id: p(req.params.id) } });
    if (!row) {
      res.status(204).end();
      return;
    }
    if (u.role === 'store_manager' && row.storeId !== u.storeId) {
      throw new HttpError(403, 'অনুমতি নেই।');
    }
    await prisma.customer.delete({ where: { id: p(req.params.id) } });
    res.status(204).end();
  }),
);

export default router;
