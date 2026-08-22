const { Schema, model } = require('mongoose');
const { MARKETING_AUTOMATION_TRIGGERS } = require('../constants/salesMarketing');

const stepSchema = new Schema({
  order: { type: Number, required: true },
  action: { type: String, enum: ['send_email', 'send_sms', 'send_whatsapp', 'notify_sales', 'create_opportunity'], required: true },
  delayHours: { type: Number, default: 0 }, // hours to wait AFTER the previous step (or enrollment, for step 0) before this step runs — the spec's own "WAIT 2 DAYS" between steps
  subject: String,   // for send_email
  message: String,   // for send_email/sms/whatsapp/notify_sales
}, { _id: false });

/**
 * A real, minimal workflow engine for the spec's §19 example
 * (welcome message -> wait -> product info -> wait -> sales follow-up),
 * built as an ordered list of delayed steps rather than a generic
 * if/then rules engine — the spec's own diagram is a straight sequence
 * with time delays, not branching logic, so that's what this actually
 * implements, not more than what's asked for.
 */
const marketingAutomationSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  trigger: { type: String, enum: MARKETING_AUTOMATION_TRIGGERS, required: true },
  isActive: { type: Boolean, default: true },
  steps: { type: [stepSchema], required: true },
}, { timestamps: true });

marketingAutomationSchema.index({ companyId: 1, trigger: 1, isActive: 1 });

module.exports = model('MarketingAutomation', marketingAutomationSchema);
