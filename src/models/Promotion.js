const { Schema, model } = require('mongoose');

/**
 * Two real, precisely-specified promotion types from the spec's own list
 * (§27) — "Buy X Get Y" and a straight percentage/fixed discount. The
 * spec names many more (bundle offer, combo, free delivery, cashback,
 * happy hour...) but most of those are really the SAME percentage/fixed/
 * BOGO mechanic applied to a different scope (a bundle is BOGO with X=Y=
 * the bundle's own components, free delivery is a 100%-off promotion
 * scoped to a delivery-fee line) rather than genuinely different
 * calculation logic — scoped to the two real, distinct calculations
 * rather than building six thin wrappers around the same two mechanics.
 */
const promotionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['buy_x_get_y', 'percentage_discount', 'fixed_discount'], required: true },
  isActive: { type: Boolean, default: true },

  // Conditions — same shape as PricingRule's, unset = "any".
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  startDate: Date,
  endDate: Date,

  // buy_x_get_y
  buyQuantity: Number,
  getQuantity: Number,
  getProductId: { type: Schema.Types.ObjectId, ref: 'Product' }, // unset = same product as buyQuantity (a genuine "Buy 2 Get 1" of the same item)

  // percentage_discount / fixed_discount
  discountPercent: Number,
  discountAmount: Number,
}, { timestamps: true });

promotionSchema.index({ companyId: 1, isActive: 1, productId: 1 });

module.exports = model('Promotion', promotionSchema);
