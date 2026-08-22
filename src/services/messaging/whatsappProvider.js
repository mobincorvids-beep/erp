/**
 * WhatsappProvider — Twilio's WhatsApp Business API, which is genuinely
 * the exact same Messages endpoint twilioProvider.js already uses for
 * SMS, just with a `whatsapp:` prefix on the To/From numbers (Twilio's
 * own documented convention) — not a different integration, so this
 * reuses that exact request shape rather than a second HTTP client
 * pattern. A separate TWILIO_WHATSAPP_FROM_NUMBER (not the plain SMS
 * from-number) because Twilio issues a distinct WhatsApp-enabled sender
 * (its own sandbox code in testing, a separately-approved number in
 * production) — using the wrong one is a real, common Twilio setup
 * mistake, not a detail to gloss over.
 *
 * Same honesty check as twilioProvider.js: correct against Twilio's
 * documented API shape, never executed against Twilio's real servers
 * from this sandbox (no account, and api.twilio.com isn't reachable from
 * this environment's network allowlist regardless). Verify against a
 * real Twilio WhatsApp sandbox before relying on it in production.
 */
async function sendWhatsapp(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM_NUMBER;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${fromNumber}`, Body: message });
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Twilio WhatsApp send failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return { success: true, provider: 'twilio_whatsapp', providerMessageId: data.sid };
}

module.exports = { sendWhatsapp };
