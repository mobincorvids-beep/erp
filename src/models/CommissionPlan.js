const { Schema, model } = require('mongoose');

const tierSchema = new Schema({
  minAmount: { type: Number, required: true },
  percent: { type: Number, required: true },
}, { _id: false });

/**
 * Sales commission plan (spec §11). `salespersonId` unset = the company's
 * default plan, applied to any salesperson with no plan of their own —
 * resolved in commissionService.resolvePlanFor(), never guessed twice.
 */
const commissionPlanSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  salespersonId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  basis: { type: String, enum: ['revenue', 'gross_profit'], default: 'revenue' },
  rateType: { type: String, enum: ['flat', 'tiered'], default: 'flat' },
  flatPercent: Number,   // used when rateType === 'flat'
  tiers: [tierSchema],   // used when rateType === 'tiered' — see commissionService's own note on how a tier is applied
}, { timestamps: true });

commissionPlanSchema.index({ companyId: 1, salespersonId: 1 });

module.exports = model('CommissionPlan', commissionPlanSchema);
