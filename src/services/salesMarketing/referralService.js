/**
 * ReferralService — CUSTOMER A refers CUSTOMER B, B makes a real
 * qualifying purchase, A gets rewarded (spec §29's own diagram). Reward
 * delivery reuses loyaltyService.awardBonusPoints() rather than a
 * separate cash/ledger mechanism — a referral bonus IS loyalty points in
 * this implementation, the same real currency of reward the rest of this
 * app's loyalty program already uses, not a second reward system to
 * maintain a conversion rate between.
 */
const crypto = require('crypto');
const Referral = require('../../models/Referral');
const ReferralConversion = require('../../models/ReferralConversion');
const loyaltyService = require('../loyaltyService');

async function getOrCreateCode(companyId, customerId, rewardPoints) {
  const existing = await Referral.findOne({ companyId, referrerCustomerId: customerId });
  if (existing) return existing;
  const code = `REF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  return Referral.create({ companyId, referrerCustomerId: customerId, code, rewardPoints: rewardPoints || 0 });
}

/** CUSTOMER B redeems A's code — real fraud-prevention floor: one referral per referred customer, ever, enforced by ReferralConversion's own unique index, not just application logic that could race. */
async function redeemCode(companyId, code, referredCustomerId) {
  const referral = await Referral.findOne({ companyId, code: code.toUpperCase() });
  if (!referral) throw new Error('Invalid referral code.');
  if (String(referral.referrerCustomerId) === String(referredCustomerId)) throw new Error('A customer cannot refer themself.');

  try {
    return await ReferralConversion.create({ companyId, referralId: referral._id, referredCustomerId });
  } catch (err) {
    if (err.code === 11000) throw new Error('This customer has already been referred by someone.');
    throw err;
  }
}

/** Called once CUSTOMER B's real qualifying purchase happens (e.g. first completed Sale) — rewards A exactly once, ever, per referred customer (idempotent on `rewarded`). */
async function rewardOnQualifyingPurchase(companyId, referredCustomerId, saleId) {
  const conversion = await ReferralConversion.findOne({ companyId, referredCustomerId, rewarded: false });
  if (!conversion) return null; // not a referred customer, or already rewarded — either way, nothing to do

  const referral = await Referral.findById(conversion.referralId);
  if (!referral || referral.rewardPoints <= 0) return null;

  await loyaltyService.awardBonusPoints(referral.referrerCustomerId, referral.rewardPoints, `Referral bonus — referred customer's first purchase`, undefined);

  conversion.qualifyingSaleId = saleId;
  conversion.rewarded = true;
  conversion.rewardedAt = new Date();
  await conversion.save();
  return conversion;
}

function dashboard(companyId, referrerCustomerId) {
  return Promise.all([
    Referral.findOne({ companyId, referrerCustomerId }),
    ReferralConversion.find({ companyId }).populate({ path: 'referralId', match: { referrerCustomerId } }),
  ]).then(([referral, conversions]) => ({
    referral,
    conversions: conversions.filter((c) => c.referralId), // populate's match filters the ref, not the array — drop the ones that didn't match
  }));
}

module.exports = { getOrCreateCode, redeemCode, rewardOnQualifyingPurchase, dashboard };
