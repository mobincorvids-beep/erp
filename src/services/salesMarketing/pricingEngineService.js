/**
 * PricingEngineService — resolves what a product actually costs a specific
 * customer, at a specific quantity, right now (spec §9). Deliberately a
 * thin layer CALLERS opt into (quotations, CPQ, sales orders) rather than
 * a change to Product.sellingPrice or the checkout hot path itself — the
 * same "compose in front of, don't modify" discipline already applied to
 * unitConversionService (see its own file header) — so nothing that
 * already reads Product/variant.sellingPrice directly is affected.
 *
 * Resolution order, most-specific wins:
 *   1. An active 'customer_price' PricingRule matching this exact customer + product
 *   2. An active 'volume_tier' PricingRule matching this product + the quantity's tier
 *   3. A ProductPrice row for the customer's own PriceGroup
 *   4. An active 'percentage_discount' PricingRule matching this product/category
 *   5. The product/variant's own default sellingPrice — the pre-existing, always-safe fallback
 */
const Product = require('../../models/Product');
const Customer = require('../../models/Customer');
const ProductPrice = require('../../models/ProductPrice');
const PricingRule = require('../../models/PricingRule');

function findVariant(product, variantId) {
  if (!variantId) return null;
  return product.variants.id ? product.variants.id(variantId) : product.variants.find((v) => String(v._id) === String(variantId));
}

function defaultPrice(product, variant) {
  return (variant && variant.sellingPrice != null) ? variant.sellingPrice : product.sellingPrice;
}

async function activeRulesFor(companyId, productId, categoryId, now) {
  return PricingRule.find({
    companyId, isActive: true,
    $and: [
      { $or: [{ productId: null }, { productId: undefined }, { productId }] },
      { $or: [{ categoryId: null }, { categoryId: undefined }, { categoryId }] },
      { $or: [{ startDate: null }, { startDate: undefined }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: undefined }, { endDate: { $gte: now } }] },
    ],
  }).sort({ priority: -1 });
}

async function resolvePrice({ companyId, productId, variantId, customerId, quantity = 1, date }) {
  const now = date || new Date();
  const product = await Product.findOne({ _id: productId, companyId });
  if (!product) throw new Error('Product not found.');
  const variant = findVariant(product, variantId);
  const fallback = defaultPrice(product, variant);

  const rules = await activeRulesFor(companyId, product._id, product.categoryId, now);

  // 1. Exact customer-specific price.
  if (customerId) {
    const customerRule = rules.find((r) => r.type === 'customer_price' && String(r.customerId) === String(customerId));
    if (customerRule) return { unitPrice: customerRule.fixedPrice, source: 'customer_price', ruleId: customerRule._id };
  }

  // 2. Volume tier — the highest minQuantity the requested quantity actually clears.
  const tierRule = rules.find((r) => r.type === 'volume_tier' && (!r.customerId || String(r.customerId) === String(customerId)));
  if (tierRule) {
    const applicable = tierRule.tiers.filter((t) => quantity >= t.minQuantity).sort((a, b) => b.minQuantity - a.minQuantity)[0];
    if (applicable) {
      const unitPrice = applicable.price != null ? applicable.price : fallback * (1 - (applicable.discountPercent || 0) / 100);
      return { unitPrice, source: 'volume_tier', ruleId: tierRule._id };
    }
  }

  // 3. Customer's price-group override.
  if (customerId) {
    const customer = await Customer.findOne({ _id: customerId, companyId });
    if (customer?.priceGroupId) {
      const productPrice = await ProductPrice.findOne({
        companyId, productId: product._id, priceGroupId: customer.priceGroupId,
        $or: [{ variantId: null }, { variantId }],
      }).sort({ variantId: -1 }); // a variant-specific row (non-null) sorts after null, so .findOne with this sort prefers the more specific one when both exist
      if (productPrice) return { unitPrice: productPrice.price, source: 'price_group', ruleId: productPrice._id };
    }
  }

  // 4. General percentage discount off the default price.
  const discountRule = rules.find((r) => r.type === 'percentage_discount' && (!r.customerId || String(r.customerId) === String(customerId)));
  if (discountRule) {
    return { unitPrice: fallback * (1 - discountRule.discountPercent / 100), source: 'percentage_discount', ruleId: discountRule._id };
  }

  // 5. Fallback — exactly what every existing caller already gets today.
  return { unitPrice: fallback, source: 'product_default', ruleId: null };
}

function setProductPrice({ companyId, productId, variantId, priceGroupId, price }) {
  return ProductPrice.findOneAndUpdate(
    { companyId, productId, variantId: variantId || null, priceGroupId },
    { price },
    { upsert: true, new: true }
  );
}

function listProductPrices(companyId, { productId, priceGroupId } = {}) {
  const filter = { companyId };
  if (productId) filter.productId = productId;
  if (priceGroupId) filter.priceGroupId = priceGroupId;
  return ProductPrice.find(filter);
}

function createRule(input) {
  const { productId, categoryId, customerId, campaignId, branchId } = input;
  if (!productId && !categoryId && !customerId && !campaignId && !branchId) {
    throw new Error('A pricing rule needs at least one real condition (product, category, customer, campaign, or branch) — a conditionless rule would silently shadow every other price.');
  }
  return PricingRule.create(input);
}

function listRules(companyId, { productId, customerId, type } = {}) {
  const filter = { companyId };
  if (productId) filter.productId = productId;
  if (customerId) filter.customerId = customerId;
  if (type) filter.type = type;
  return PricingRule.find(filter).sort({ priority: -1 });
}

module.exports = { resolvePrice, setProductPrice, listProductPrices, createRule, listRules };
