/**
 * LoyaltyService — points earn/redeem. Earning is a post-checkout side
 * effect (like FbrService: never blocks or rolls back a sale). Redemption
 * is pre-checkout: it converts points into a currency value the caller
 * passes into PosSaleService as a discount, so redemption still goes
 * through the normal checkout accounting rather than becoming its own
 * parallel payment method with separate ledger logic.
 */
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');

async function getProgram(companyId) {
  return LoyaltyProgram.findOne({ companyId, isActive: true });
}

/**
 * A customer's tier (spec §26), qualified by LIFETIME EARNED points (the
 * sum of every real 'earn' transaction ever posted for them), never by
 * their current spendable balance — redeeming points to below a tier's
 * threshold must not demote them, the same way a frequent-flyer status
 * isn't lost by spending miles. Returns null when no tiers are
 * configured (the default) or none qualify yet.
 */
async function currentTier(customerId, program) {
  if (!program || !program.tiers || program.tiers.length === 0) return null;
  const earned = await LoyaltyTransaction.aggregate([
    { $match: { customerId: new mongoose.Types.ObjectId(customerId), type: 'earn' } },
    { $group: { _id: null, total: { $sum: '$points' } } },
  ]);
  const lifetimePoints = earned[0]?.total || 0;
  const qualifying = [...program.tiers].sort((a, b) => b.minLifetimePoints - a.minLifetimePoints).find((t) => lifetimePoints >= t.minLifetimePoints);
  return qualifying ? { ...qualifying, lifetimePoints } : null;
}

/** Awards points for a completed sale. Called after checkout succeeds — see saleController. */
async function earnPointsForSale(sale) {
  const program = await getProgram(sale.companyId);
  if (!program || !sale.customerId) return null;

  const earnableAmount = sale.subtotal - sale.discountAmount; // net of discount, before tax
  const basePoints = Math.floor(earnableAmount / program.earnRate);
  if (basePoints <= 0) return null;

  // Tier multiplier applied here, based on standing BEFORE this sale's own
  // points are added — a company with no tiers configured gets
  // multiplier 1 (currentTier returns null), so `points` is exactly
  // `basePoints`, byte-identical to this function's behavior before
  // tiers existed. This read happens before the transaction below opens
  // (a pure aggregation query, no write), the same "no I/O inside the
  // transaction that doesn't need to be there" discipline every other
  // pre-transaction lookup in this app already follows.
  const tier = await currentTier(sale.customerId, program);
  const points = tier ? Math.floor(basePoints * tier.pointsMultiplier) : basePoints;
  if (points <= 0) return null;

  const session = await mongoose.startSession();
  try {
    let txn;
    await session.withTransaction(async () => {
      await Customer.findByIdAndUpdate(sale.customerId, { $inc: { loyaltyPoints: points } }, { session });
      [txn] = await LoyaltyTransaction.create(
        [{ companyId: sale.companyId, customerId: sale.customerId, type: 'earn', points, saleId: sale._id, note: `Earned on sale ${sale.invoiceNumber}` }],
        { session }
      );
    });
    return txn;
  } finally {
    session.endSession();
  }
}

/**
 * Converts a requested points amount into a currency discount value, and
 * deducts the points immediately (reserved against this checkout). If the
 * checkout that follows fails, call reverseRedemption() to refund the points.
 *
 * @returns {{ points: Number, discountValue: Number }}
 */
async function redeemPoints(customerId, requestedPoints, userId) {
  const program = await getProgram((await Customer.findById(customerId))?.companyId);
  if (!program) throw new Error('No active loyalty program for this company.');
  if (requestedPoints < program.minRedeemPoints) {
    throw new Error(`Minimum redemption is ${program.minRedeemPoints} points.`);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const customer = await Customer.findById(customerId).session(session);
      if (!customer) throw new Error('Customer not found.');
      if (customer.loyaltyPoints < requestedPoints) {
        throw new Error(`Insufficient points: has ${customer.loyaltyPoints}, requested ${requestedPoints}.`);
      }

      customer.loyaltyPoints -= requestedPoints;
      await customer.save({ session });

      await LoyaltyTransaction.create(
        [{ companyId: customer.companyId, customerId, type: 'redeem', points: -requestedPoints, note: 'Redeemed at checkout', userId }],
        { session }
      );

      result = { points: requestedPoints, discountValue: Math.round(requestedPoints * program.redemptionValue * 100) / 100 };
    });
    return result;
  } finally {
    session.endSession();
  }
}

/** Refunds points if a redemption was reserved but the checkout it was for didn't complete. */
async function reverseRedemption(customerId, points, userId) {
  const customer = await Customer.findByIdAndUpdate(customerId, { $inc: { loyaltyPoints: points } }, { new: true });
  if (!customer) throw new Error('Customer not found.');
  await LoyaltyTransaction.create({
    companyId: customer.companyId, customerId, type: 'adjustment', points,
    note: 'Reversed unused redemption', userId,
  });
  return customer;
}

async function history(customerId) {
  return LoyaltyTransaction.find({ customerId }).sort({ createdAt: -1 }).limit(200);
}

/**
 * A genuine, generically-named award of points from outside a checkout —
 * referral bonuses (spec §29) are the first real caller. Deliberately NOT
 * routed through reverseRedemption(), which is specifically for undoing a
 * reserved-but-unused checkout redemption — reusing it for an unrelated
 * "give this customer bonus points" case would be the wrong semantic
 * borrowed for convenience, the kind of mislabeled reuse this codebase's
 * own history warns against.
 */
async function awardBonusPoints(customerId, points, note, userId) {
  if (!(points > 0)) throw new Error('points must be greater than zero.');
  const customer = await Customer.findByIdAndUpdate(customerId, { $inc: { loyaltyPoints: points } }, { new: true });
  if (!customer) throw new Error('Customer not found.');
  await LoyaltyTransaction.create({ companyId: customer.companyId, customerId, type: 'adjustment', points, note, userId });
  return customer;
}

module.exports = { getProgram, currentTier, earnPointsForSale, redeemPoints, reverseRedemption, awardBonusPoints, history };
