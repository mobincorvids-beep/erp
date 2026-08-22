const { Schema, model } = require('mongoose');

// One customer's real subscription to a plan. recurringTemplateId links
// to the actual RecurringInvoiceTemplate doing the billing once the
// subscription is active — null while trialing, since a trial customer
// hasn't been billed yet.
const subscriptionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, // stored even while trialing — the queue sweep that activates billing after the trial ends has no request context to supply this from, so it has to already be on the record
  planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  recurringTemplateId: { type: Schema.Types.ObjectId, ref: 'RecurringInvoiceTemplate', default: null },
  status: { type: String, enum: ['trialing', 'active', 'paused', 'cancelled'], default: 'active' },
  trialEndsAt: Date,
  cancelledAt: Date,
}, { timestamps: true });

subscriptionSchema.index({ companyId: 1, customerId: 1, status: 1 });

module.exports = model('Subscription', subscriptionSchema);
