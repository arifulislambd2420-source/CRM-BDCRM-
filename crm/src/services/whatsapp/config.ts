/**
 * WhatsApp integration mode.
 *
 * 'click_to_chat'  — safe, always works. Builds wa.me links + manual "Log WhatsApp contact"
 *                     quick-action on customers. Use this today.
 * 'cloud_api'      — official Meta WhatsApp Business Cloud API. Requires Business Verification,
 *                     a registered number, and API credentials. See cloudApiAdapter.ts.
 *
 * Do NOT add an unofficial / QR-session mode here — reverse-engineered libraries risk
 * getting the business number banned. If we ever want that route, isolate it in a
 * separate microservice, never inside this CRM.
 */
export type WhatsAppMode = 'click_to_chat' | 'cloud_api';

export const whatsappConfig: {
  mode: WhatsAppMode;
  defaultStoreNumber: string; // E.164 without leading +
} = {
  mode: 'click_to_chat',
  defaultStoreNumber: '8801700000000',
};
