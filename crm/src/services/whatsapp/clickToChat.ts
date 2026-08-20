/**
 * Click-to-chat helper. Builds a wa.me URL that opens WhatsApp with a
 * prefilled message. The `sourceTag` is embedded so staff can later tell
 * which page/campaign a chat came from.
 */
export interface ClickToChatOptions {
  storeNumber: string; // E.164 without leading + (e.g. "8801700000000")
  message?: string; // customer-facing prefilled text
  sourceTag?: string; // e.g. "fb-ad-tafseer-2026", embedded into the message
}

export function generateWhatsAppLink({
  storeNumber,
  message = 'আসসালামু আলাইকুম, আমি আপনাদের বই সম্পর্কে জানতে চাই।',
  sourceTag,
}: ClickToChatOptions): string {
  const number = storeNumber.replace(/[^\d]/g, '');
  const full = sourceTag ? `${message}\n\n[src:${sourceTag}]` : message;
  return `https://wa.me/${number}?text=${encodeURIComponent(full)}`;
}

/**
 * Parses a source tag out of an incoming WhatsApp message body if the customer
 * clicked one of our generated links. Returns null if no tag is present.
 */
export function parseSourceTag(messageBody: string): string | null {
  const m = messageBody.match(/\[src:([\w.-]+)\]/);
  return m ? m[1] : null;
}

/**
 * Normalize a Bangladesh phone number to E.164 without the leading + sign,
 * which is the format wa.me expects. Accepts:
 *   "01700123456"  → "8801700123456"
 *   "8801700123456" → "8801700123456"
 *   "+8801700123456" → "8801700123456"
 * Non-Bangladesh numbers already prefixed with a country code pass through.
 */
export function toE164BD(local: string): string {
  const digits = (local ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return '88' + digits;
  // Assume already country-coded (or a foreign number). Return as-is.
  return digits;
}
