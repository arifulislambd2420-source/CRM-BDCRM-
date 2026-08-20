import { Router } from 'express';
import { HttpError, currentUser, requireAuth } from '../auth.js';
import { db } from '../db.js';
import type { AuthUser } from '../types.js';
import { asyncHandler, makeId } from '../utils.js';

interface CustomerLite {
  id: string;
  store_id: string;
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

/**
 * Server-side twin of frontend `canModifyNote`. This is now the source of
 * truth — the frontend gates the UI, but rejection here is what actually
 * prevents unauthorized edits.
 */
function canModifyNote(user: AuthUser, note: NoteRow): boolean {
  if (user.role === 'admin') return true;
  if (note.created_by_id !== user.id) return false;
  return user.canEditOwnNotes === true;
}

function assertVisibleCustomer(user: AuthUser, id: string): CustomerLite {
  const row = db.prepare(`SELECT id, store_id FROM customers WHERE id = ?`).get(id) as
    | CustomerLite
    | undefined;
  if (!row) throw new HttpError(404, 'কাস্টমার পাওয়া যায়নি।');
  if (user.role === 'store_manager' && row.store_id !== user.storeId) {
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
    assertVisibleCustomer(u, customerId);
    const text = String(req.body?.text ?? '').trim();
    if (!text) throw new HttpError(400, 'নোট খালি রাখা যাবে না।');

    // Sequential per-customer, max+1 so numbers never recycle.
    const maxRow = db
      .prepare(`SELECT COALESCE(MAX(number), 0) AS m FROM notes WHERE customer_id = ?`)
      .get(customerId) as { m: number };
    const number = maxRow.m + 1;

    const id = makeId('note');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO notes (id, customer_id, number, text, created_at, created_by_id, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, customerId, number, text, now, u.id, u.name);

    res.status(201).json({
      id, number, text,
      createdAt: now, createdById: u.id, createdByName: u.name,
    });
  }),
);

router.patch(
  '/:noteId',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const customerId = String(req.params.customerId ?? '');
    assertVisibleCustomer(u, customerId);
    const note = db
      .prepare(`SELECT * FROM notes WHERE id = ? AND customer_id = ?`)
      .get(req.params.noteId, customerId) as NoteRow | undefined;
    if (!note) throw new HttpError(404, 'নোট পাওয়া যায়নি।');
    if (!canModifyNote(u, note)) throw new HttpError(403, 'এই নোট সম্পাদনার অনুমতি নেই।');
    const text = String(req.body?.text ?? '').trim();
    if (!text) throw new HttpError(400, 'নোট খালি রাখা যাবে না।');
    db.prepare(`UPDATE notes SET text = ? WHERE id = ?`).run(text, note.id);
    res.json({ ...note, text, createdAt: note.created_at, createdById: note.created_by_id, createdByName: note.created_by_name });
  }),
);

router.delete(
  '/:noteId',
  asyncHandler(async (req, res) => {
    const u = currentUser(req);
    const customerId = String(req.params.customerId ?? '');
    assertVisibleCustomer(u, customerId);
    const note = db
      .prepare(`SELECT * FROM notes WHERE id = ? AND customer_id = ?`)
      .get(req.params.noteId, customerId) as NoteRow | undefined;
    if (!note) {
      res.status(204).end();
      return;
    }
    if (!canModifyNote(u, note)) throw new HttpError(403, 'এই নোট মোছার অনুমতি নেই।');
    db.prepare(`DELETE FROM notes WHERE id = ?`).run(note.id);
    res.status(204).end();
  }),
);

export default router;
