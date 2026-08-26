/**
 * Conversations API — unified inbox.
 *
 * GET  /api/conversations          — list (sorted by lastMessageAt desc)
 * GET  /api/conversations/:id      — single conversation + messages
 * POST /api/conversations/:id/send — send outbound message (WhatsApp or Messenger)
 * POST /api/conversations/:id/read — mark as read (unreadCount = 0)
 * GET  /api/conversations/:id/link-customer — link to an existing customer
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { makeId, p } from '../utils.js';

const router = Router();
router.use(requireAuth);

// ── List ─────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const channel = req.query.channel as string | undefined;
  const where = channel ? { channel } : {};

  const convs = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      messages: { orderBy: { sentAt: 'desc' }, take: 1 },
    },
  });

  return res.json(convs);
});

// ── Single ────────────────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  const conv = await prisma.conversation.findUnique({
    where: { id: p(req.params.id) },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      messages: { orderBy: { sentAt: 'asc' } },
      integrationAccount: { select: { id: true, label: true, accountType: true } },
    },
  });
  if (!conv) return res.status(404).json({ error: 'not found' });
  return res.json(conv);
});

// ── Mark read ─────────────────────────────────────────────────────────────────

router.post('/:id/read', async (req: Request, res: Response) => {
  await prisma.conversation.update({
    where: { id: p(req.params.id) },
    data: { unreadCount: 0 },
  });
  return res.json({ ok: true });
});

// ── Link customer ─────────────────────────────────────────────────────────────

router.post('/:id/link-customer', async (req: Request, res: Response) => {
  const { customerId } = req.body as { customerId: string };
  const conv = await prisma.conversation.update({
    where: { id: p(req.params.id) },
    data: { customerId },
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });
  return res.json(conv);
});

// ── Send outbound message ─────────────────────────────────────────────────────

router.post('/:id/send', async (req: Request, res: Response) => {
  const { text } = req.body as { text: string };
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const conv = await prisma.conversation.findUnique({
    where: { id: p(req.params.id) },
    include: { integrationAccount: true },
  });
  if (!conv) return res.status(404).json({ error: 'not found' });

  const account = conv.integrationAccount;
  if (!account.active) return res.status(400).json({ error: 'integration account inactive' });
  if (!account.accessToken) return res.status(400).json({ error: 'access token not configured' });

  let waMessageId: string | null = null;
  let sendError: string | null = null;

  if (conv.channel === 'whatsapp') {
    const url = `https://graph.facebook.com/v19.0/${account.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: conv.remoteId,
      type: 'text',
      text: { body: text },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${account.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      const data = (await resp.json()) as { messages?: Array<{ id: string }> };
      waMessageId = data.messages?.[0]?.id ?? null;
    } else {
      sendError = await resp.text();
      return res.status(502).json({ error: 'WhatsApp send failed', detail: sendError });
    }
  } else if (conv.channel === 'messenger') {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${account.accessToken}`;
    const payload = {
      recipient: { id: conv.remoteId },
      message: { text },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      const data = (await resp.json()) as { message_id?: string };
      waMessageId = data.message_id ?? null;
    } else {
      sendError = await resp.text();
      return res.status(502).json({ error: 'Messenger send failed', detail: sendError });
    }
  } else {
    return res.status(400).json({ error: 'unknown channel' });
  }

  const msg = await prisma.message.create({
    data: {
      id: makeId('msg'),
      conversationId: conv.id,
      direction: 'outbound',
      body: text,
      waMessageId,
      sentAt: new Date(),
    },
  });

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: msg.sentAt },
  });

  return res.json(msg);
});

export default router;
