/**
 * Meta Conversions API helper.
 * Sends server-side Purchase events when an order is confirmed and
 * the customer has WhatsApp (ctwa_clid) or Messenger (messenger_psid) attribution.
 *
 * Credentials (dataset ID + access token) are stored in IntegrationAccount rows
 * and never exposed to the frontend.
 */

import { prisma } from './db.js';
import { makeId } from './utils.js';
import crypto from 'crypto';

export interface CAPIEventInput {
  orderId: string;
  customerId: string;
  customerPhone?: string | null;
  customerName?: string | null;
  ctwaClid?: string | null;
  messengerPsid?: string | null;
  channel: 'whatsapp' | 'messenger';
  value: number; // order total in BDT
  currency?: string;
}

export async function sendCAPIEvent(input: CAPIEventInput): Promise<void> {
  // Load the active integration account for the relevant channel
  const account = await prisma.integrationAccount.findFirst({
    where: { accountType: input.channel, active: true },
  });

  if (!account?.accessToken || !account.wabaId) {
    // No configured account — log and bail silently
    console.warn('[CAPI] No active integration account for channel:', input.channel);
    return;
  }

  // The Pixel/Dataset ID is stored in wabaId field for WhatsApp accounts,
  // and pageId for Messenger. Use whichever is present.
  const datasetId = account.wabaId ?? account.pageId;
  if (!datasetId) return;

  const eventTime = Math.floor(Date.now() / 1000);

  const userData: Record<string, unknown> = {
    client_ip_address: '0.0.0.0', // not available server-side from webhook
    client_user_agent: 'CRM-Server',
  };

  if (input.customerPhone) {
    userData.ph = [sha256(normalizePhone(input.customerPhone))];
  }
  if (input.ctwaClid) {
    userData.ctwa_clid = input.ctwaClid;
  }
  if (input.messengerPsid) {
    userData.page_scoped_user_id = input.messengerPsid;
  }

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: eventTime,
        action_source: 'chat',
        user_data: userData,
        custom_data: {
          currency: input.currency ?? 'BDT',
          value: input.value,
          order_id: input.orderId,
        },
      },
    ],
  };

  const payloadStr = JSON.stringify(payload);
  const url = `https://graph.facebook.com/v19.0/${datasetId}/events?access_token=${account.accessToken}`;

  let responseStatus: number | null = null;
  let responseBody: string | null = null;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadStr,
    });
    responseStatus = resp.status;
    responseBody = await resp.text();
    if (!resp.ok) {
      console.warn('[CAPI] Non-OK response:', responseStatus, responseBody);
    }
  } catch (err) {
    console.error('[CAPI] Network error:', err);
    responseBody = String(err);
  }

  // Always log the attempt regardless of outcome
  await prisma.conversionEvent.create({
    data: {
      id: makeId('capi'),
      orderId: input.orderId,
      customerId: input.customerId,
      eventName: 'Purchase',
      channel: input.channel,
      ctwaClid: input.ctwaClid ?? null,
      messengerPsid: input.messengerPsid ?? null,
      payload: payloadStr,
      responseStatus,
      responseBody,
    },
  });
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Prepend country code if missing (Bangladesh = 880)
  if (digits.startsWith('0')) return '880' + digits.slice(1);
  if (!digits.startsWith('880')) return '880' + digits;
  return digits;
}
