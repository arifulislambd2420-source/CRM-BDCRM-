import { Router } from 'express';
import { HttpError, currentUser, requireAuth } from '../auth.js';
import { db } from '../db.js';
import type { Customer, Note } from '../types.js';
import { asyncHandler, makeId } from '../utils.js';

const router = Router();
router.use(requireAuth);

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  address: string;
  source: string;
  pipeline_id: string;
  current_stage_id: string;
  store_id: string;
  created_at: string;
  created_by_id: string;
}
interface NoteRow {
  id: string;
  customer_id: string;
  number: number;
  text: string;
  created_at: string;
  created_by_id: string;
  created_by_name: string;
}

function loadNotes(customerId: string): Note[] {
  return (db
    .prepare(`SELECT * FROM notes WHERE customer_id = ? ORDER BY number ASC`)
    .all(customerId) as NoteRow[]).map((n) => ({
    id: n.id,
    number: n.number,
    text: n.text,
    createdAt: n.created_at,
    createdById: n.created_by_id,
    createdByName: n.created_by_name,
  }));
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    source: row.source,
    pipelineId: row.pipeline_id,
    currentStageId: row.current_stage_id,
    storeId: row.store_id,
    createdAt: row.created_at,
    createdById: row.created_by_id,
    notes: loadNotes(row.id),
  };
}

/** GET /api/customers — role-scoped list. Store managers see only their own store. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const rows =
      u.role === 'store_manager'
        ? (db.prepare(`SELECT * FROM customers WHERE store_id = ? ORDER BY created_at DESC`)
            .all(u.storeId) as CustomerRow[])
        : (db.prepare(`SELECT * FROM customers ORDER BY created_at DESC`).all() as CustomerRow[]);
    res.json(rows.map(toCustomer));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const row = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id) as
      | CustomerRow
      | undefined;
    if (!row) throw new HttpError(404, 'কাস্টমার পাওয়া যায়নি।');
    if (u.role === 'store_manager' && row.store_id !== u.storeId) {
      throw new HttpError(403, 'অনুমতি নেই।');
    }
    res.json(toCustomer(row));
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
    const id = makeId('cust');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO customers
        (id, name, phone, address, source, pipeline_id, current_stage_id, store_id, created_at, created_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, String(b.name), String(b.phone), String(b.address ?? ''),
      String(b.source ?? ''), String(b.pipelineId), String(b.currentStageId),
      storeId, now, u.id,
    );
    const row = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id) as CustomerRow;
    res.status(201).json(toCustomer(row));
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const row = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id) as
      | CustomerRow
      | undefined;
    if (!row) throw new HttpError(404, 'কাস্টমার পাওয়া যায়নি।');
    if (u.role === 'store_manager' && row.store_id !== u.storeId) {
      throw new HttpError(403, 'আপনার এই কাস্টমার সম্পাদনার অনুমতি নেই।');
    }
    const b = req.body ?? {};
    const fields: Array<[string, unknown]> = [];
    if (b.name !== undefined) fields.push(['name', String(b.name)]);
    if (b.phone !== undefined) fields.push(['phone', String(b.phone)]);
    if (b.address !== undefined) fields.push(['address', String(b.address)]);
    if (b.source !== undefined) fields.push(['source', String(b.source)]);
    if (b.pipelineId !== undefined) fields.push(['pipeline_id', String(b.pipelineId)]);
    if (b.currentStageId !== undefined) fields.push(['current_stage_id', String(b.currentStageId)]);
    if (b.storeId !== undefined && u.role !== 'store_manager') {
      fields.push(['store_id', String(b.storeId)]);
    }
    if (fields.length > 0) {
      const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE customers SET ${setClause} WHERE id = ?`).run(
        ...fields.map(([, v]) => v),
        req.params.id,
      );
    }
    const updated = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id) as CustomerRow;
    res.json(toCustomer(updated));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const row = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id) as
      | CustomerRow
      | undefined;
    if (!row) {
      res.status(204).end();
      return;
    }
    if (u.role === 'store_manager' && row.store_id !== u.storeId) {
      throw new HttpError(403, 'অনুমতি নেই।');
    }
    db.prepare(`DELETE FROM customers WHERE id = ?`).run(req.params.id);
    res.status(204).end();
  }),
);

export default router;
