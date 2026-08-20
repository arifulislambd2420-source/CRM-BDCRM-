/**
 * Meta WhatsApp Business Cloud API adapter — STUB.
 *
 * Going live requires:
 *   1. A Meta Business account with Business Verification approved
 *   2. A registered WhatsApp Business phone number (dedicated to WA, not tied
 *      to a personal WhatsApp account)
 *   3. A Meta App with the WhatsApp product enabled → Phone Number ID + a
 *      permanent System User access token
 *   4. A public HTTPS webhook URL for receiving messages (with a verify token)
 *   5. Message templates pre-approved for anything sent outside the 24-hour
 *      customer-initiated window
 *
 * Fill in `env` below from a real backend `.env` — DO NOT ship API tokens in
 * the browser bundle. This adapter should ultimately live server-side and be
 * exposed to the CRM as a thin `/api/whatsapp/*` proxy.
 */

interface CloudApiEnv {
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken: string;
  apiVersion: string; // e.g. "v21.0"
}

// Filled by backend at runtime. Empty strings = not configured yet.
const env: CloudApiEnv = {
  phoneNumberId: '',
  accessToken: '',
  webhookVerifyToken: '',
  apiVersion: 'v21.0',
};

export interface OutgoingMessage {
  to: string; // E.164, without leading +
  body: string;
  templateName?: string; // required if outside 24h session window
  templateLanguage?: string; // e.g. "bn"
}

export interface IncomingMessage {
  from: string; // E.164
  messageId: string;
  body: string;
  timestamp: string; // ISO
  profileName?: string;
}

export async function sendMessage(msg: OutgoingMessage): Promise<{ id: string }> {
  // TODO: POST https://graph.facebook.com/{apiVersion}/{phoneNumberId}/messages
  //       with Authorization: Bearer {accessToken}
  console.warn('[whatsapp cloudApi] sendMessage stub — not yet wired.', msg);
  if (!env.phoneNumberId) {
    throw new Error('WhatsApp Cloud API is not configured. See cloudApiAdapter.ts.');
  }
  return { id: 'stub-' + Date.now() };
}

/**
 * Meta calls this webhook endpoint (via your backend) for each incoming message.
 * Return the parsed message; the caller should then hand it to syncIncomingLead().
 */
export function receiveWebhook(rawPayload: unknown): IncomingMessage[] {
  // TODO: parse Meta's webhook envelope (entry[].changes[].value.messages[])
  console.warn('[whatsapp cloudApi] receiveWebhook stub — not yet wired.', rawPayload);
  return [];
}

/**
 * Given an incoming WA message, upsert a Customer + append a Note.
 * Wire this into the CRM services (customers, notes) once the Cloud API is live.
 */
export async function syncIncomingLead(msg: IncomingMessage): Promise<void> {
  // TODO:
  //  1. Look up customer by phone (msg.from). If missing, create one with
  //     source='WhatsApp', pipeline='WhatsApp লিড', stage=first.
  //  2. Append a Note with the message body and timestamp.
  //  3. If parseSourceTag(msg.body) returned a tag, persist it as a customer
  //     attribute so we know which campaign converted.
  console.warn('[whatsapp cloudApi] syncIncomingLead stub — not yet wired.', msg);
}
