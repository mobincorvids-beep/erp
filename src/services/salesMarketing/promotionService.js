/**
 * PromotionService — same "pre-checkout calculation, caller applies the
 * result as a normal discount" pattern as couponService/loyaltyService.
 * findApplicable() is pure and read-only; the effect functions are pure
 * arithmetic with no side effects, safe to call speculatively.
 */
const Promotion = require('../../models/Promotion');

function createPromotion(input) {
  const { type, buyQuantity, getQuantity, discountPercent, discountAmount } = input;
  if (type === 'buy_x_get_y' && !(buyQuantity > 0 && getQuantity > 0)) throw new Error('buyQuantity and getQuantity must both be greater than zero for a buy_x_get_y promotion.');
  if (type === 'percentage_discount' && !(discountPercent > 0 && discountPercent <= 100)) throw new Error('discountPercent must be between 0 and 100.');
  if (type === 'fixed_discount' && !(discountAmount > 0)) throw new Error('discountAmount must be greater than zero.');
  return Promotion.create(input);
}

function listPromotions(companyId) {
  return Promotion.find({ companyId, isActive: true });
}

/** Every active promotion that genuinely applies to this product right now (date range, branch, customer, if set). */
async function findApplicable(companyId, { productId, categoryId, branchId, customerId, date } = {}) {
  const now = date || new Date();
  return Promotion.find({
    companyId, isActive: true,
    $and: [
      { $or: [{ productId: null }, { productId: undefined }, { productId }] },
      { $or: [{ categoryId: null }, { categoryId: undefined }, { categoryId }] },
      { $or: [{ branchId: null }, { branchId: undefined }, { branchId }] },
      { $or: [{ customerId: null }, { customerId: undefined }, { customerId }] },
      { $or: [{ startDate: null }, { startDate: undefined }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: undefined }, { endDate: { $gte: now } }] },
    ],
  });
}

/**
 * Pure calculation — given a promotion and a real cart line (productId,
 * quantity, unitPrice), returns what it's actually worth. For
 * buy_x_get_y, the free/discounted units are computed as complete
 * (buyQuantity+getQuantity) groups within the quantity purchased — buying
 * 5 on a "Buy 2 Get 1" gets exactly 1 free unit (one complete group of 3),
 * not 2 (which would need 6), the correct floor-division reading of the
 * spec's own mechanic, hand-verified rather than assumed.
 */
function computeEffect(promotion, { quantity, unitPrice }) {
  if (promotion.type === 'buy_x_get_y') {
    const groupSize = promotion.buyQuantity + promotion.getQuantity;
    const completeGroups = Math.floor(quantity / groupSize);
    const freeUnits = completeGroups * promotion.getQuantity;
    const freeUnitPrice = promotion.getProductId ? null : unitPrice; // a different free product's price isn't known from this line alone — the caller resolves it if getProductId is set
    const discountValue = freeUnitPrice != null ? Math.round(freeUnits * freeUnitPrice * 100) / 100 : null;
    return { freeUnits, getProductId: promotion.getProductId || null, discountValue };
  }
  if (promotion.type === 'percentage_discount') {
    const lineTotal = quantity * unitPrice;
    return { discountValue: Math.round(lineTotal * (promotion.discountPercent / 100) * 100) / 100 };
  }
  // fixed_discount
  return { discountValue: Math.min(promotion.discountAmount, quantity * unitPrice) };
}

module.exports = { createPromotion, listPromotions, findApplicable, computeEffect };
