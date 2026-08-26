/**
 * CRUD for IntegrationAccount — admin only.
 * Credentials (accessToken, appSecret) are write-only from the UI:
 * GET responses blank them out so they never travel to the browser.
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { HttpError, requireAuth, requireRole } from '../auth.js';
import { asyncHandler, makeId, p } from '../utils.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

function toApi(acc: any) {
  return {
    id: acc.id,
    accountType: acc.accountType,
    label: acc.label,
    active: acc.active,
    wabaId: acc.wabaId ?? '',
    phoneNumberId: acc.phoneNumberId ?? '',
    pageId: acc.pageId ?? '',
    appId: acc.appId ?? '',
    webhookVerifyToken: acc.webhookVerifyToken ?? '',
    // Never send secrets to the frontend
    appSecret: acc.appSecret ? '••••••••' : '',
    accessToken: acc.accessToken ? '••••••••' : '',
    createdAt: acc.createdAt.toISOString(),
    updatedAt: acc.updatedAt.toISOString(),
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const accounts = await prisma.integrationAccount.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json(accounts.map(toApi));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      accountType, label, active = true,
      wabaId, phoneNumberId, pageId, appId,
      appSecret, accessToken, webhookVerifyToken,
    } = req.body as Record<string, string | boolean>;

    if (!accountType || !label) {
      throw new HttpError(400, 'accountType এবং label আবশ্যক।');
    }
    if (!['whatsapp', 'messenger'].includes(accountType as string)) {
      throw new HttpError(400, 'accountType হতে হবে whatsapp বা messenger।');
    }

    const acc = await prisma.integrationAccount.create({
      data: {
        id: makeId('ia'),
        accountType: accountType as 'whatsapp' | 'messenger',
        label: String(label),
        active: Boolean(active),
        wabaId: wabaId ? String(wabaId) : null,
        phoneNumberId: phoneNumberId ? String(phoneNumberId) : null,
        pageId: pageId ? String(pageId) : null,
        appId: appId ? String(appId) : null,
        appSecret: appSecret ? String(appSecret) : null,
        accessToken: accessToken ? String(accessToken) : null,
        webhookVerifyToken: webhookVerifyToken ? String(webhookVerifyToken) : null,
      },
    });

    res.status(201).json(toApi(acc));
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = p(req.params.id);
    const existing = await prisma.integrationAccount.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'অ্যাকাউন্ট পাওয়া যায়নি।');

    const {
      label, active,
      wabaId, phoneNumberId, pageId, appId,
      appSecret, accessToken, webhookVerifyToken,
    } = req.body as Record<string, string | boolean | undefined>;

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = String(label);
    if (active !== undefined) data.active = Boolean(active);
    if (wabaId !== undefined) data.wabaId = wabaId ? String(wabaId) : null;
    if (phoneNumberId !== undefined) data.phoneNumberId = phoneNumberId ? String(phoneNumberId) : null;
    if (pageId !== undefined) data.pageId = pageId ? String(pageId) : null;
    if (appId !== undefined) data.appId = appId ? String(appId) : null;
    if (webhookVerifyToken !== undefined) data.webhookVerifyToken = webhookVerifyToken ? String(webhookVerifyToken) : null;
    // Only overwrite secrets if a real value is provided (not the masked placeholder)
    if (appSecret && appSecret !== '••••••••') data.appSecret = String(appSecret);
    if (accessToken && accessToken !== '••••••••') data.accessToken = String(accessToken);

    const updated = await prisma.integrationAccount.update({ where: { id }, data });
    res.json(toApi(updated));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = p(req.params.id);
    await prisma.integrationAccount.delete({ where: { id } }).catch(() => {
      throw new HttpError(404, 'অ্যাকাউন্ট পাওয়া যায়নি।');
    });
    res.json({ ok: true });
  }),
);

export default router;
