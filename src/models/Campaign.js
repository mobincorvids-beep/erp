const { Schema, model } = require('mongoose');
const { CAMPAIGN_CHANNELS } = require('../constants/salesMarketing');

// A batch send targeted at customers matching one or more tags, PLUS the
// spec's own campaign-tracking fields (§18: budget, dates, audience,
// offer/coupon/landing-page attribution) for channels no real delivery
// transport exists for in this app (Facebook/Google/TikTok ads etc — see
// crmService.sendCampaign's own honest rejection of those at send time).
// Actual delivery for sms/email/whatsapp goes through a real, pluggable
// provider (see services/messaging/) — a working console/log transport by
// default, real Twilio/SendGrid HTTP calls if those credentials are
// configured. successCount/failureCount are populated from the actual
// per-recipient result of that call, not assumed.
const campaignSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  channel: { type: String, required: true, enum: CAMPAIGN_CHANNELS },
  message: { type: String, required: true },
  targetTags: [{ type: String }], // customers with ANY of these tags are recipients; empty = all customers
  status: { type: String, default: 'draft', enum: ['draft', 'sent'] },
  recipientCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  provider: String, // which transport actually handled this send — 'console', 'twilio', 'sendgrid', 'twilio_whatsapp'
  sentAt: Date,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },

  // Tracking/attribution fields (spec §18) — all optional, all additive.
  campaignType: String, // free text: "product launch", "seasonal sale", ...
  startDate: Date,
  endDate: Date,
  budget: { type: Number, default: 0 },
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  territoryId: { type: Schema.Types.ObjectId, ref: 'Territory' },
  offer: String,
  couponCode: String,
  landingPageId: { type: Schema.Types.ObjectId, ref: 'LandingPage' },
}, { timestamps: true });

module.exports = model('Campaign', campaignSchema);
