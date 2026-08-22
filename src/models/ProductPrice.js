const { Schema, model } = require('mongoose');

/**
 * The real second half of "multiple price lists" (spec §9) —
 * `Customer.priceGroupId` and `PriceGroup` (Retail/Wholesale/VIP...) have
 * existed in this schema, but nothing ever read `priceGroupId` anywhere
 * (confirmed by grep before writing this — the exact "schema promised
 * something the code never delivered" pattern this codebase's own history
 * already names for `Unit.conversionFactor` and `PayrollRun.advances`).
 * `Product.sellingPrice`/`variant.sellingPrice` remain the single default/
 * retail price — this collection holds PER-PRICE-GROUP overrides on top of
 * that default, so existing code that only ever reads `Product.sellingPrice`
 * keeps working exactly as before; only callers that go through the new
 * `pricingEngineService.resolvePrice()` see price-group-aware pricing.
 */
const productPriceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, default: null }, // null = applies to every variant of this product that has no more specific row of its own
  priceGroupId: { type: Schema.Types.ObjectId, ref: 'PriceGroup', required: true },
  price: { type: Number, required: true },
}, { timestamps: true });

productPriceSchema.index({ companyId: 1, productId: 1, variantId: 1, priceGroupId: 1 }, { unique: true });

module.exports = model('ProductPrice', productPriceSchema);
