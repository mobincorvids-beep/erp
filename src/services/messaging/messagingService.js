/**
 * MessagingService — the single place that decides which transport
 * actually handles an SMS/email send. Automatically uses a real provider
 * (Twilio for SMS, SendGrid for email) the moment its credentials are
 * present in the environment; falls back to the console transport
 * otherwise, so this module works out of the box with zero configuration
 * — loudly, via console output, not silently pretending to have sent
 * something real.
 */
const consoleProvider = require('./consoleProvider');
const twilioProvider = require('./twilioProvider');
const sendgridProvider = require('./sendgridProvider');
const whatsappProvider = require('./whatsappProvider');

function hasTwilioConfig() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}
function hasSendGridConfig() {
  return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}
// Distinct from hasTwilioConfig() — a WhatsApp sender is a separately
// provisioned/approved Twilio number, not the plain SMS from-number (see
// whatsappProvider.js's own comment on why this matters).
function hasWhatsappConfig() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM_NUMBER);
}

/** @returns {Promise<{success: boolean, provider: string, error?: string}>} — never throws; a failed send is a normal, expected outcome for one recipient in a batch, not a reason to abort the whole campaign. */
async function sendSms(to, message) {
  if (!to) return { success: false, provider: 'none', error: 'No phone number on file for this customer.' };
  try {
    if (hasTwilioConfig()) return await twilioProvider.sendSms(to, message);
    return await consoleProvider.sendSms(to, message);
  } catch (err) {
    return { success: false, provider: hasTwilioConfig() ? 'twilio' : 'console', error: err.message };
  }
}

/** Same contract as sendSms — never throws. */
async function sendEmail(to, subject, message) {
  if (!to) return { success: false, provider: 'none', error: 'No email address on file for this customer.' };
  try {
    if (hasSendGridConfig()) return await sendgridProvider.sendEmail(to, subject, message);
    return await consoleProvider.sendEmail(to, subject, message);
  } catch (err) {
    return { success: false, provider: hasSendGridConfig() ? 'sendgrid' : 'console', error: err.message };
  }
}

/** Same contract as sendSms/sendEmail — never throws. */
async function sendWhatsapp(to, message) {
  if (!to) return { success: false, provider: 'none', error: 'No WhatsApp number on file for this customer.' };
  try {
    if (hasWhatsappConfig()) return await whatsappProvider.sendWhatsapp(to, message);
    return await consoleProvider.sendWhatsapp(to, message);
  } catch (err) {
    return { success: false, provider: hasWhatsappConfig() ? 'twilio_whatsapp' : 'console', error: err.message };
  }
}

function activeSmsProvider() { return hasTwilioConfig() ? 'twilio' : 'console'; }
function activeEmailProvider() { return hasSendGridConfig() ? 'sendgrid' : 'console'; }
function activeWhatsappProvider() { return hasWhatsappConfig() ? 'twilio_whatsapp' : 'console'; }

module.exports = { sendSms, sendEmail, sendWhatsapp, activeSmsProvider, activeEmailProvider, activeWhatsappProvider };
