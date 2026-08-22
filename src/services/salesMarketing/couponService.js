/**
 * CouponService — real validation and redemption tracking (spec §28).
 * Deliberately does NOT modify posSaleService.checkout() — the same
 * "pre-checkout, converts into a value the caller passes into the
 * normal accounting" pattern loyaltyService.redeemPoints() already
 * established. A UI calls validate() before checkout to show the real
 * discount, then passes that discount as a normal line/header discount
 * into checkout, then calls redeem() to record it — checkout itself
 * never needs to know coupons exist.
 */
const crypto = require('crypto');
const Coupon = require('../../models/Coupon');
const CouponRedemption = require('../../models/CouponRedemption');

function createCoupon(input) {
  const { code, type, value } = input;
  if (!code) throw new Error('code is required.');
  if (type === 'percentage' && (value <= 0 || value > 100)) throw new Error('A percentage coupon\'s value must be between 0 and 100.');
  return Coupon.create({ ...input, code: code.toUpperCase() });
}

function generateCode(prefix = 'SAVE') {
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Pure, read-only eligibility + real discount amount — no writes here, so a UI can safely call this on every keystroke/cart change. */
async function validateCoupon(companyId, code, { customerId, purchaseAmount, productIds } = {}) {
  const coupon = await Coupon.findOne({ companyId, code: code.toUpperCase(), isActive: true });
  if (!coupon) return { valid: false, reason: 'Invalid or inactive coupon code.' };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { valid: false, reason: 'This coupon has expired.' };
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) return { valid: false, reason: 'This coupon has reached its usage limit.' };
  if (purchaseAmount < coupon.minPurchase) return { valid: false, reason: `Minimum purchase of ${coupon.minPurchase} required.` };

  if (coupon.productIds.length > 0 && productIds) {
    const overlap = productIds.some((id) => coupon.productIds.some((cid) => String(cid) === String(id)));
    if (!overlap) return { valid: false, reason: 'This coupon does not apply to any product in the cart.' };
  }

  if (customerId) {
    const customerUsage = await CouponRedemption.countDocuments({ couponId: coupon._id, customerId });
    if (customerUsage >= coupon.perCustomerLimit) return { valid: false, reason: 'You have already used this coupon the maximum number of times.' };

    if (coupon.isFirstOrderOnly) {
      const Sale = require('../../models/Sale');
      const priorOrders = await Sale.countDocuments({ companyId, customerId, status: 'completed' });
      if (priorOrders > 0) return { valid: false, reason: 'This coupon is valid for first orders only.' };
    }
  }

  let discountAmount = coupon.type === 'percentage' ? purchaseAmount * (coupon.value / 100) : coupon.value;
  if (coupon.maxDiscount != null) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  discountAmount = Math.round(Math.min(discountAmount, purchaseAmount) * 100) / 100; // never discount more than the purchase itself

  return { valid: true, coupon, discountAmount };
}

/** Records a real redemption — call AFTER a checkout that already applied the discount, so this is a record of what happened, not a reservation of what might. */
async function redeemCoupon(companyId, code, { customerId, saleId, purchaseAmount, productIds }) {
  const check = await validateCoupon(companyId, code, { customerId, purchaseAmount, productIds });
  if (!check.valid) throw new Error(check.reason);

  await CouponRedemption.create({ companyId, couponId: check.coupon._id, customerId, saleId, discountApplied: check.discountAmount });
  await Coupon.findByIdAndUpdate(check.coupon._id, { $inc: { usageCount: 1 } });

  return check;
}

function listCoupons(companyId) {
  return Coupon.find({ companyId }).sort({ createdAt: -1 });
}

module.exports = { createCoupon, generateCode, validateCoupon, redeemCoupon, listCoupons };
