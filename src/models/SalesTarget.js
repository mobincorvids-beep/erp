const { Schema, model } = require('mongoose');

/**
 * A sales target/quota (spec §12) — scoped by whichever ONE of these is
 * set (salesperson, branch, territory, product, or category); explicit
 * date range rather than a "period type + reference date" pair, since
 * computing "the 3rd quarter of 2026" from a type+date is exactly the
 * kind of date-math this codebase's own history (Real Estate's fixed
 * 30-day lease periods) has already learned to avoid when a plain
 * explicit range is just as easy and can't be got wrong.
 */
const salesTargetSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  label: { type: String, required: true }, // "August 2026", "Q3 Karachi", etc. — free text, not derived

  salespersonId: { type: Schema.Types.ObjectId, ref: 'User' },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  territoryId: { type: Schema.Types.ObjectId, ref: 'Territory' },
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },

  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  targetValue: { type: Number, required: true }, // revenue target — the spec's own primary KPI ("Sales target", "Actual sales", "Achievement %")
}, { timestamps: true });

salesTargetSchema.index({ companyId: 1, salespersonId: 1, periodStart: 1 });
salesTargetSchema.index({ companyId: 1, branchId: 1, periodStart: 1 });

module.exports = model('SalesTarget', salesTargetSchema);
