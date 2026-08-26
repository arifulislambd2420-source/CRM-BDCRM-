/**
 * WhatsApp Cloud API webhook.
 *
 * GET  /api/webhook/whatsapp  — hub verification (Meta sends this when you register the webhook)
 * POST /api/webhook/whatsapp  — incoming messages / status updates
 *
 * Credentials are loaded from the matching IntegrationAccount row (phoneNumberId match).
 * All Meta credentials stay server-side; nothing is forwarded to the frontend.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { makeId } from '../utils.js';

export const whatsappWebhookRouter = Router();

// ── GET: hub verification ────────────────────────────────────────────────────

whatsappWebhookRouter.get('/', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode !== 'subscribe' || !token) {
    return res.sendStatus(400);
  }

  // Find matching integration account by verify token
  const account = await prisma.integrationAccount.findFirst({
    where: { accountType: 'whatsapp', webhookVerifyToken: token, active: true },
  });

  if (!account) {
    return res.sendStatus(403);
  }

  return res.status(200).send(challenge);
});

// ── POST: incoming events ────────────────────────────────────────────────────

whatsappWebhookRouter.post('/', async (req: Request, res: Response) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  const body = req.body as WAWebhookPayload;
  if (body.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;

      // Load the matching account
      const account = await prisma.integrationAccount.findFirst({
        where: { accountType: 'whatsapp', phoneNumberId, active: true },
      });
      if (!account) continue;

      // Process incoming messages
      for (const msg of value.messages ?? []) {
        await handleIncomingMessage(account.id, value, msg);
      }
    }
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function handleIncomingMessage(
  integrationAccountId: string,
  value: WAValue,
  msg: WAMessage,
) {
  const waId = msg.from; // sender's WhatsApp phone number
  const waMessageId = msg.id;

  // Dedup: skip if we already stored this message
  const existing = await prisma.message.findUnique({ where: { waMessageId } });
  if (existing) return;

  // Extract text body
  const body = msg.text?.body ?? null;
  const mediaType = msg.type !== 'text' ? msg.type : null;

  // Find or create Customer from wa_id
  let customer = await prisma.customer.findUnique({ where: { whatsappWaId: waId } });
  const contactName =
    value.contacts?.find((c) => c.wa_id === waId)?.profile?.name ?? waId;

  // Find or create Conversation
  let conversation = await prisma.conversation.findUnique({
    where: {
      integrationAccountId_remoteId: {
        integrationAccountId,
        remoteId: waId,
      },
    },
  });

  if (!conversation) {
    // Capture ctwa_clid if present (click-to-WhatsApp ad attribution)
    const ctwaClid =
      (msg as any).referral?.ctwa_clid ?? null;

    // If customer doesn't exist yet, create a stub — store manager can fill details later
    if (!customer) {
      // First try to find by phone (normalised)
      const phone = normalizePhone(waId);
      customer = await prisma.customer.findFirst({ where: { phone } });
    }

    if (!customer && ctwaClid) {
      // Update customer's attribution if we find them later — skip creation here
      // (Creating a customer requires pipeline/stage which we can't determine from webhook)
    }

    conversation = await prisma.conversation.create({
      data: {
        id: makeId('conv'),
        channel: 'whatsapp',
        integrationAccountId,
        customerId: customer?.id ?? null,
        remoteId: waId,
        displayName: contactName,
        lastMessageAt: new Date(Number(msg.timestamp) * 1000),
        unreadCount: 1,
      },
    });

    // Record first-contact attribution on customer
    if (customer && !customer.firstContactChannel) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          whatsappWaId: waId,
          firstContactChannel: 'whatsapp',
          firstContactAt: new Date(Number(msg.timestamp) * 1000),
          ctwaClid: (msg as any).referral?.ctwa_clid ?? customer.ctwaClid,
        },
      });
    }
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(Number(msg.timestamp) * 1000),
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
      mediaType,
      waMessageId,
      sentAt: new Date(Number(msg.timestamp) * 1000),
    },
  });
}

function normalizePhone(waId: string): string {
  // WhatsApp wa_id is E.164 without '+'. Store phone format may vary.
  return waId.replace(/\D/g, '');
}

// ── WhatsApp payload types ────────────────────────────────────────────────────

interface WAWebhookPayload {
  object: string;
  entry: Array<{
    changes: Array<{
      field: string;
      value: WAValue;
    }>;
  }>;
}

interface WAValue {
  metadata?: { phone_number_id: string };
  messages?: WAMessage[];
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
}

interface WAMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}
