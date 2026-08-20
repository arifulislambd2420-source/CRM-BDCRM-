import { Router } from 'express';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils.js';

async function readSources(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: 'sources' } });
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function writeSources(sources: string[]): Promise<void> {
  const value = JSON.stringify(sources);
  await prisma.setting.upsert({
    where: { key: 'sources' },
    create: { key: 'sources', value },
    update: { value },
  });
}

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ sources: await readSources() });
  }),
);

router.put(
  '/sources',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const list = req.body?.sources;
    if (!Array.isArray(list)) throw new HttpError(400, 'sources অ্যারে দিন।');
    const cleaned = list.map((s) => String(s).trim()).filter(Boolean);
    await writeSources(cleaned);
    res.json({ sources: cleaned });
  }),
);

export default router;
