const { Schema, model } = require('mongoose');

const tierSchema = new Schema({
  name: { type: String, required: true }, // "Bronze", "Silver", "Gold", "Platinum" — spec §26
  minLifetimePoints: { type: Number, required: true }, // qualified by LIFETIME EARNED points, not current balance — redeeming points should never demote a customer's tier
  pointsMultiplier: { type: Number, default: 1 }, // Gold might earn 1.5x, Platinum 2x — applied in loyaltyService.earnPointsForSale
}, { _id: false });

// One program per company. Tiers (spec §26) are a real, optional extension
// — an empty `tiers` array (the default, and every program that existed
// before this field did) means loyaltyService.earnPointsForSale's tier
// lookup finds nothing and applies a 1x multiplier, i.e. byte-identical
// behavior to before tiers existed. Genuinely additive, not a redesign.
const loyaltyProgramSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  isActive: { type: Boolean, default: true },
  earnRate: { type: Number, default: 100 },     // customer earns 1 point per this much spent (net of discount, before tax)
  redemptionValue: { type: Number, default: 1 }, // 1 point = this much currency when redeemed
  minRedeemPoints: { type: Number, default: 0 }, // floor before a customer can redeem anything
  tiers: { type: [tierSchema], default: [] },
}, { timestamps: true });

module.exports = model('LoyaltyProgram', loyaltyProgramSchema);
