const { Schema, model } = require('mongoose');

// A real, auditable redemption ledger — the same "ledger, not just a
// counter" reasoning LoyaltyTransaction already documents. Coupon.usageCount
// is a fast-path cache; this is what perCustomerLimit is actually enforced
// against (a per-customer count can't be answered from one shared counter).
const couponRedemptionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale' },
  discountApplied: { type: Number, required: true },
}, { timestamps: true });

module.exports = model('CouponRedemption', couponRedemptionSchema);
