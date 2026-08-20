import { Router } from 'express';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { db } from '../db.js';
import type { Pipeline } from '../types.js';
import { asyncHandler, makeId } from '../utils.js';

const router = Router();

interface PipelineRow { id: string; name: string }
interface StageRow { id: string; pipeline_id: string; name: string; sort_index: number }

function loadPipelines(): Pipeline[] {
  const ps = db.prepare(`SELECT * FROM pipelines ORDER BY name ASC`).all() as PipelineRow[];
  const stages = db.prepare(`SELECT * FROM stages ORDER BY sort_index ASC`).all() as StageRow[];
  return ps.map((p) => ({
    id: p.id,
    name: p.name,
    stages: stages
      .filter((s) => s.pipeline_id === p.id)
      .map((s) => ({ id: s.id, name: s.name })),
  }));
}

router.use(requireAuth);
router.get('/', (_req, res) => res.json(loadPipelines()));

// Everything below this line is admin-only.
router.use(requireRole('admin'));

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    const id = makeId('pl');
    db.prepare(`INSERT INTO pipelines (id, name) VALUES (?, ?)`).run(id, name);
    res.status(201).json({ id, name, stages: [] });
  }),
);

router.patch(
  '/:pipelineId',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    db.prepare(`UPDATE pipelines SET name = ? WHERE id = ?`).run(name, req.params.pipelineId);
    res.json({ ok: true });
  }),
);

/** Block pipeline delete if any customer references it. */
router.delete(
  '/:pipelineId',
  asyncHandler(async (req, res) => {
    const { n } = db
      .prepare(`SELECT COUNT(*) AS n FROM customers WHERE pipeline_id = ?`)
      .get(req.params.pipelineId) as { n: number };
    if (n > 0) {
      throw new HttpError(400, `${n} জন কাস্টমার এই পাইপলাইনে আছে। আগে তাদের অন্য পাইপলাইনে সরান।`);
    }
    db.prepare(`DELETE FROM pipelines WHERE id = ?`).run(req.params.pipelineId);
    res.status(204).end();
  }),
);

router.post(
  '/:pipelineId/stages',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    const nextIdx = (db
      .prepare(`SELECT COALESCE(MAX(sort_index), -1) AS m FROM stages WHERE pipeline_id = ?`)
      .get(req.params.pipelineId) as { m: number }).m + 1;
    const id = makeId('st');
    db.prepare(`INSERT INTO stages (id, pipeline_id, name, sort_index) VALUES (?, ?, ?, ?)`)
      .run(id, req.params.pipelineId, name, nextIdx);
    res.status(201).json({ id, name });
  }),
);

router.patch(
  '/:pipelineId/stages/:stageId',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    db.prepare(`UPDATE stages SET name = ? WHERE id = ? AND pipeline_id = ?`)
      .run(name, req.params.stageId, req.params.pipelineId);
    res.json({ ok: true });
  }),
);

/** Block stage delete if customers currently sit on it. */
router.delete(
  '/:pipelineId/stages/:stageId',
  asyncHandler(async (req, res) => {
    const { n } = db
      .prepare(`SELECT COUNT(*) AS n FROM customers WHERE current_stage_id = ?`)
      .get(req.params.stageId) as { n: number };
    if (n > 0) {
      throw new HttpError(400, `এই স্টেজে ${n} জন কাস্টমার আছে। আগে তাদের অন্য স্টেজে সরান।`);
    }
    db.prepare(`DELETE FROM stages WHERE id = ? AND pipeline_id = ?`)
      .run(req.params.stageId, req.params.pipelineId);
    res.status(204).end();
  }),
);

/** Body: { orderedIds: string[] } — writes a new sort_index per id. */
router.post(
  '/:pipelineId/reorder',
  asyncHandler(async (req, res) => {
    const orderedIds = req.body?.orderedIds;
    if (!Array.isArray(orderedIds)) throw new HttpError(400, 'orderedIds অ্যারে দিন।');
    const upd = db.prepare(`UPDATE stages SET sort_index = ? WHERE id = ? AND pipeline_id = ?`);
    const trx = db.transaction(() => {
      orderedIds.forEach((id, i) => upd.run(i, String(id), req.params.pipelineId));
    });
    trx();
    res.json({ ok: true });
  }),
);

export default router;
