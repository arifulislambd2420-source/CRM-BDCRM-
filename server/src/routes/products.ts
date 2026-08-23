import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { prisma } from '../db.js';
import { deleteImageFile, saveProductImage, uploadImage } from '../upload.js';
import { asyncHandler, makeId, p } from '../utils.js';

type ProductRow = Awaited<ReturnType<typeof prisma.product.findFirst>>;

function toApi(p: NonNullable<ProductRow>) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    price: Number(p.price),
    stockQuantity: p.stockQuantity,
    imagePath: p.imagePath ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const router = Router();
router.use(requireAuth);

/** Any authenticated user can browse the catalog (store managers see it read-only). */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(rows.map(toApi));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await prisma.product.findUnique({ where: { id: p(req.params.id) } });
    if (!row) throw new HttpError(404, 'প্রোডাক্ট পাওয়া যায়নি।');
    res.json(toApi(row));
  }),
);

// From here on: admin + sub-admin only.
router.use(requireRole('admin', 'sub_admin'));

/**
 * multipart/form-data:
 *   name (required)
 *   price (required, decimal string)
 *   stockQuantity (required, integer)
 *   description (optional)
 *   image (optional file)
 */
router.post(
  '/',
  uploadImage.single('image'),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const priceStr = String(req.body?.price ?? '');
    const stockStr = String(req.body?.stockQuantity ?? '');
    const description = String(req.body?.description ?? '').trim() || null;
    if (!name) throw new HttpError(400, 'নাম দিন।');
    const priceNum = Number(priceStr);
    if (!Number.isFinite(priceNum) || priceNum < 0) throw new HttpError(400, 'দাম দিন।');
    const stockNum = Number.parseInt(stockStr, 10);
    if (!Number.isFinite(stockNum) || stockNum < 0) throw new HttpError(400, 'স্টক দিন।');

    let imagePath: string | null = null;
    if (req.file) imagePath = await saveProductImage(req.file.buffer);

    const created = await prisma.product.create({
      data: {
        id: makeId('prod'),
        name,
        description,
        price: priceNum.toFixed(2),
        stockQuantity: stockNum,
        imagePath,
      },
    });
    res.status(201).json(toApi(created));
  }),
);

router.patch(
  '/:id',
  uploadImage.single('image'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: p(req.params.id) } });
    if (!existing) throw new HttpError(404, 'প্রোডাক্ট পাওয়া যায়নি।');

    const data: Prisma.ProductUpdateInput = {};
    if (req.body?.name !== undefined) {
      const n = String(req.body.name).trim();
      if (!n) throw new HttpError(400, 'নাম খালি রাখা যাবে না।');
      data.name = n;
    }
    if (req.body?.description !== undefined) {
      const d = String(req.body.description).trim();
      data.description = d || null;
    }
    if (req.body?.price !== undefined) {
      const priceNum = Number(req.body.price);
      if (!Number.isFinite(priceNum) || priceNum < 0) throw new HttpError(400, 'দাম দিন।');
      data.price = priceNum.toFixed(2);
    }
    if (req.body?.stockQuantity !== undefined) {
      const stockNum = Number.parseInt(String(req.body.stockQuantity), 10);
      if (!Number.isFinite(stockNum) || stockNum < 0) throw new HttpError(400, 'স্টক দিন।');
      data.stockQuantity = stockNum;
    }
    if (req.file) {
      data.imagePath = await saveProductImage(req.file.buffer);
      deleteImageFile(existing.imagePath); // free the old file
    }

    const updated = await prisma.product.update({
      where: { id: p(req.params.id) },
      data,
    });
    res.json(toApi(updated));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: p(req.params.id) } });
    if (!existing) {
      res.status(204).end();
      return;
    }
    await prisma.product.delete({ where: { id: p(req.params.id) } });
    deleteImageFile(existing.imagePath);
    res.status(204).end();
  }),
);

export default router;
