const { Schema, model } = require('mongoose');

/**
 * A dealer/distributor/agent/reseller/franchise (spec §30's "Channel
 * Sales" module). Deliberately linked to a real Customer record
 * (customerId) rather than duplicating orders/ledger/pricing logic — a
 * partner buying from this company IS a customer of it, exactly the same
 * relationship a wholesale customer already has; Partner adds only the
 * channel-specific attributes (type, KYC, commission, rebates) on top of
 * that existing Customer, reusing salesOrderService/customerLedgerService/
 * pricingEngineService for everything else (orders, statements, contract
 * pricing via a customer_price PricingRule) rather than parallel versions
 * of each.
 */
const partnerSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['dealer', 'distributor', 'agent', 'reseller', 'franchise'], required: true },
  territoryId: { type: Schema.Types.ObjectId, ref: 'Territory' },

  kycStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  // Real KYC documents (spec's own line item) reuse the existing Document
  // engine (entityType: 'Partner', entityId: this partner's own _id) —
  // no separate file-attachment schema here.

  commissionPercent: { type: Number, default: 0 }, // partner commission (spec §30) — computed the same way sales commission is, see partnerService.calculateCommission
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Partner', partnerSchema);
