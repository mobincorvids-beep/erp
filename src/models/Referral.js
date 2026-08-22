const { Schema, model } = require('mongoose');

// One real referral code per referring customer — generated once,
// reused for every friend they refer (not one code per referral), so
// "share your code" is a single stable link/code, matching how every
// real referral program (spec §29) actually works.
const referralSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  referrerCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
  code: { type: String, required: true },
  rewardPoints: { type: Number, default: 0 }, // awarded to the REFERRER once a referred customer's qualifying purchase happens — see referralService.rewardOnQualifyingPurchase
}, { timestamps: true });

referralSchema.index({ companyId: 1, code: 1 }, { unique: true });

module.exports = model('Referral', referralSchema);
