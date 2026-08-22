const { Schema, model } = require('mongoose');

const tierSchema = new Schema({
  minQuantity: { type: Number, required: true },
  price: Number,            // set for a 'volume_tier' rule — the flat unit price at this quantity break
  discountPercent: Number,  // set for a 'volume_discount' rule instead
}, { _id: false });

/**
 * The conditions/rules half of the Pricing Engine (spec §9) — resolved by
 * pricingEngineService.resolvePrice() alongside ProductPrice (the flatter
 * per-price-group override). A rule always narrows by at least one real
 * condition (product/category/customer/campaign/branch/date range) — a
 * ruleset with no conditions at all would apply to everything, which is
 * what Product.sellingPrice already is, so that case is rejected at
 * creation rather than allowed to silently shadow every other price.
 */
const pricingRuleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 0 }, // higher wins when more than one rule matches — see resolvePrice's sort

  type: { type: String, enum: ['volume_tier', 'customer_price', 'percentage_discount'], required: true },

  // Conditions — every one set on a rule must match for it to apply; unset = "any".
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
  startDate: Date,
  endDate: Date,

  // Effect — which of these is read depends on `type`.
  tiers: [tierSchema],          // volume_tier
  fixedPrice: Number,           // customer_price
  discountPercent: Number,      // percentage_discount

  // The spec's own "minimum margin" / "salesperson discount limit"
  // guardrails — enforced by discountApprovalService, not silently ignored.
  minMarginPercent: Number,
  maxDiscountPercent: Number,
}, { timestamps: true });

pricingRuleSchema.index({ companyId: 1, isActive: 1, productId: 1 });
pricingRuleSchema.index({ companyId: 1, isActive: 1, customerId: 1 });

module.exports = model('PricingRule', pricingRuleSchema);
