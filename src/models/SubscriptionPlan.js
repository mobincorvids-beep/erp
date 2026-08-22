const { Schema, model } = require('mongoose');

const planItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
}, { _id: false });

// A subscription plan (spec §32) — what gets billed and how often. The
// actual recurring billing mechanics are recurringInvoiceService's, not
// duplicated here (see SubscriptionPlan's own genuinely new contribution:
// trialDays — RecurringInvoiceTemplate has no concept of a trial period).
const subscriptionPlanSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  billingCycle: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'annually'], required: true },
  items: { type: [planItemSchema], required: true },
  trialDays: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('SubscriptionPlan', subscriptionPlanSchema);
