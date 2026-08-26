/**
 * Facebook Messenger webhook.
 *
 * GET  /api/webhook/messenger  — hub verification
 * POST /api/webhook/messenger  — incoming messages / postbacks
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { makeId } from '../utils.js';

export const messengerWebhookRouter = Router();

// ── GET: hub verification ────────────────────────────────────────────────────

messengerWebhookRouter.get('/', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode !== 'subscribe' || !token) return res.sendStatus(400);

  const account = await prisma.integrationAccount.findFirst({
    where: { accountType: 'messenger', webhookVerifyToken: token, active: true },
  });

  if (!account) return res.sendStatus(403);
  return res.status(200).send(challenge);
});

// ── POST: incoming events ────────────────────────────────────────────────────

messengerWebhookRouter.post('/', async (req: Request, res: Response) => {
  res.sendStatus(200);

  const body = req.body as MessengerWebhookPayload;
  if (body.object !== 'page') return;

  for (const entry of body.entry ?? []) {
    const pageId = entry.id;

    const account = await prisma.integrationAccount.findFirst({
      where: { accountType: 'messenger', pageId, active: true },
    });
    if (!account) continue;

    for (const messaging of entry.messaging ?? []) {
      if (!messaging.message) continue; // skip read receipts, typing indicators
      await handleIncomingMessage(account.id, pageId, messaging);
    }
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function handleIncomingMessage(
  integrationAccountId: string,
  pageId: string,
  messaging: MessagingEvent,
) {
  const psid = messaging.sender.id;
  const mid = messaging.message!.mid;

  // Dedup
  const existing = await prisma.message.findUnique({ where: { waMessageId: mid } });
  if (existing) return;

  const body = messaging.message!.text ?? null;
  const sentAt = new Date(messaging.timestamp);

  // Find existing customer by Messenger PSID
  const customer = await prisma.customer.findFirst({
    where: { messengerPsid: psid, messengerPageId: pageId },
  });

  // Find or create conversation
  let conversation = await prisma.conversation.findUnique({
    where: {
      integrationAccountId_remoteId: { integrationAccountId, remoteId: psid },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        id: makeId('conv'),
        channel: 'messenger',
        integrationAccountId,
        customerId: customer?.id ?? null,
        remoteId: psid,
        displayName: psid, // name resolved later via Graph API if needed
        lastMessageAt: sentAt,
        unreadCount: 1,
      },
    });

    // Record attribution
    if (customer && !customer.firstContactChannel) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          messengerPsid: psid,
          messengerPageId: pageId,
          firstContactChannel: 'messenger',
          firstContactAt: sentAt,
        },
      });
    }
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: sentAt,
        unreadCount: { increment: 1 },
        customerId: conversation.customerId ?? customer?.id ?? null,
      },
    });
  }

  await prisma.message.create({
    data: {
      id: makeId('msg'),
      conversationId: conversation.id,
      direction: 'inbound',
      body,
      waMessageId: mid, // re-used field for any platform's message ID
      sentAt,
    },
  });
}

// ── Payload types ─────────────────────────────────────────────────────────────

interface MessengerWebhookPayload {
  object: string;
  entry: Array<{
    id: string; // page ID
    messaging: MessagingEvent[];
  }>;
}

interface MessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: { mid: string; text?: string };
}
