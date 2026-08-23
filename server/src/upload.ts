import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';

/**
 * File-upload plumbing.
 *
 * multer receives the raw upload in memory (small images only — 5 MB cap
 * below), then we hand the buffer to sharp, resize to max 400px on the
 * longest edge, encode as JPEG (quality 82), and write to disk.
 * The DB only stores the relative path (e.g. "products/abc123.jpg"); the
 * express.static handler at /uploads serves it back.
 */
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
export const PRODUCTS_DIR = path.join(UPLOAD_ROOT, 'products');

fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

/** In-memory upload; 5 MB cap. */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif|avif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('শুধু ছবি আপলোড করা যাবে (jpg/png/webp)।'));
  },
});

/**
 * Resize, re-encode as JPEG, save under products/. Returns the relative
 * path that goes into the DB (never the absolute path).
 */
export async function saveProductImage(buffer: Buffer): Promise<string> {
  const id = crypto.randomBytes(10).toString('hex');
  const relPath = path.posix.join('products', `${id}.jpg`);
  const absPath = path.join(UPLOAD_ROOT, relPath);
  await sharp(buffer)
    .rotate() // honour EXIF orientation
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(absPath);
  return relPath;
}

/** Best-effort delete of an image file when the referencing row goes away. */
export function deleteImageFile(relPath: string | null | undefined): void {
  if (!relPath) return;
  const safe = path.normalize(relPath).replace(/^([./\\])+/, '');
  const abs = path.join(UPLOAD_ROOT, safe);
  // Only delete files under UPLOAD_ROOT — guard against `..` in the DB value.
  if (!abs.startsWith(UPLOAD_ROOT)) return;
  fs.rm(abs, { force: true }, () => {});
}
