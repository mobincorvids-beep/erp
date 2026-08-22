const { Schema, model } = require('mongoose');

// One real record per referred customer — CUSTOMER A refers CUSTOMER B
// (spec §29's own diagram); B is linked here the moment they redeem A's
// code, and `rewarded` flips true only once B's real qualifying purchase
// actually happens, which is what fraud prevention (spec's own line item)
// most needs: a referral that never converts into a real purchase never
// pays out anything.
const referralConversionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  referralId: { type: Schema.Types.ObjectId, ref: 'Referral', required: true },
  referredCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true }, // a customer can be referred once, by exactly one referrer — real fraud-prevention floor
  qualifyingSaleId: { type: Schema.Types.ObjectId, ref: 'Sale' },
  rewarded: { type: Boolean, default: false },
  rewardedAt: Date,
}, { timestamps: true });

module.exports = model('ReferralConversion', referralConversionSchema);
