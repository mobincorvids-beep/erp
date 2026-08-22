/**
 * SocialLeadService — the real, generalizable half of "connect Facebook/
 * Instagram/LinkedIn/TikTok/YouTube -> capture comment/message/lead form
 * -> ERP Lead" (spec §23). Actually authenticating against each
 * platform's real OAuth/webhook-signature scheme (Meta's app-secret HMAC,
 * LinkedIn's own handshake, ...) is real, separate, per-platform
 * integration work this codebase has no credentials to build or verify
 * against — the same honest boundary FBR/Twilio/SendGrid already draw.
 * What's genuinely built: one real, secured inbound endpoint
 * (middleware/socialLeadAuth.js) any of those platforms' own webhook
 * relay (or a middleware tool like Zapier/Make bridging the real
 * platform APIs to this one endpoint) can be pointed at, which turns a
 * real payload into a real Lead with real source attribution.
 */
const crypto = require('crypto');
const Company = require('../../models/Company');
const leadService = require('./leadService');
const { LEAD_SOURCES } = require('../../constants/salesMarketing');

const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];

async function generateWebhookToken(companyId) {
  const token = crypto.randomBytes(32).toString('hex');
  await Company.findByIdAndUpdate(companyId, { socialLeadWebhookToken: token });
  return token;
}

/** @param {String} platform one of SOCIAL_PLATFORMS — mapped to the matching Lead source ('facebook' etc. — a subset of LEAD_SOURCES, verified at call time rather than assumed to line up). */
async function captureLead(companyId, platform, payload) {
  if (!SOCIAL_PLATFORMS.includes(platform)) throw new Error(`Unsupported social platform: ${platform}.`);
  if (!LEAD_SOURCES.includes(platform)) throw new Error(`"${platform}" is not a valid lead source — check constants/salesMarketing.js stayed in sync.`);

  const { name, phone, email, message } = payload;
  if (!name) throw new Error('name is required in the lead payload.');

  return leadService.createLead({
    companyId, name, phone, email, notes: message, source: platform,
  });
}

module.exports = { generateWebhookToken, captureLead, SOCIAL_PLATFORMS };
