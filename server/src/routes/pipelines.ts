import { Router } from 'express';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { prisma } from '../db.js';
import type { Pipeline } from '../types.js';
import { asyncHandler, makeId, p } from '../utils.js';

async function loadPipelines(): Promise<Pipeline[]> {
  const rows = await prisma.pipeline.findMany({
    orderBy: { name: 'asc' },
    include: { stages: { orderBy: { sortIndex: 'asc' } } },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    stages: p.stages.map((s) => ({ id: s.id, name: s.name })),
  }));
}

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(async (_req, res) => res.json(await loadPipelines())));

// Admin-only mutations.
router.use(requireRole('admin'));

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    const created = await prisma.pipeline.create({
      data: { id: makeId('pl'), name },
    });
    res.status(201).json({ id: created.id, name: created.name, stages: [] });
  }),
);

router.patch(
  '/:pipelineId',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    await prisma.pipeline.update({
      where: { id: p(req.params.pipelineId) },
      data: { name },
    });
    res.json({ ok: true });
  }),
);

router.delete(
  '/:pipelineId',
  asyncHandler(async (req, res) => {
    const n = await prisma.customer.count({ where: { pipelineId: p(req.params.pipelineId) } });
    if (n > 0) {
      throw new HttpError(400, `${n} জন কাস্টমার এই পাইপলাইনে আছে। আগে তাদের অন্য পাইপলাইনে সরান।`);
    }
    await prisma.pipeline.delete({ where: { id: p(req.params.pipelineId) } });
    res.status(204).end();
  }),
);

router.post(
  '/:pipelineId/stages',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    const nextIdx =
      ((await prisma.stage.aggregate({
        _max: { sortIndex: true },
        where: { pipelineId: p(req.params.pipelineId) },
      }))._max.sortIndex ?? -1) + 1;
    const stage = await prisma.stage.create({
      data: {
        id: makeId('st'),
        pipelineId: p(req.params.pipelineId),
        name,
        sortIndex: nextIdx,
      },
    });
    res.status(201).json({ id: stage.id, name: stage.name });
  }),
);

router.patch(
  '/:pipelineId/stages/:stageId',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw new HttpError(400, 'নাম দিন।');
    await prisma.stage.updateMany({
      where: { id: p(req.params.stageId), pipelineId: p(req.params.pipelineId) },
      data: { name },
    });
    res.json({ ok: true });
  }),
);

router.delete(
  '/:pipelineId/stages/:stageId',
  asyncHandler(async (req, res) => {
    const n = await prisma.customer.count({ where: { currentStageId: p(req.params.stageId) } });
    if (n > 0) {
      throw new HttpError(400, `এই স্টেজে ${n} জন কাস্টমার আছে। আগে তাদের অন্য স্টেজে সরান।`);
    }
    await prisma.stage.deleteMany({
      where: { id: p(req.params.stageId), pipelineId: p(req.params.pipelineId) },
    });
    res.status(204).end();
  }),
);

/** Body: { orderedIds: string[] } — rewrite sort_index for each. */
router.post(
  '/:pipelineId/reorder',
  asyncHandler(async (req, res) => {
    const orderedIds = req.body?.orderedIds;
    if (!Array.isArray(orderedIds)) throw new HttpError(400, 'orderedIds অ্যারে দিন।');
    await prisma.$transaction(
      orderedIds.map((id: string, i: number) =>
        prisma.stage.updateMany({
          where: { id: String(id), pipelineId: p(req.params.pipelineId) },
          data: { sortIndex: i },
        }),
      ),
    );
    res.json({ ok: true });
  }),
);

export default router;
