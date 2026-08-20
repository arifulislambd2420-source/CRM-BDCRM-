import { Router } from 'express';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { db } from '../db.js';
import { asyncHandler } from '../utils.js';

function readSources(): string[] {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'sources'`).get() as
    | { value: string }
    | undefined;
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeSources(sources: string[]): void {
  const value = JSON.stringify(sources);
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('sources', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(value);
}

const router = Router();
router.use(requireAuth);
router.get('/', (_req, res) => res.json({ sources: readSources() }));

router.put(
  '/sources',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const list = req.body?.sources;
    if (!Array.isArray(list)) throw new HttpError(400, 'sources অ্যারে দিন।');
    const cleaned = list.map((s) => String(s).trim()).filter(Boolean);
    writeSources(cleaned);
    res.json({ sources: cleaned });
  }),
);

export default router;
