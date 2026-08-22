const { Schema, model } = require('mongoose');

/**
 * One entity's (Lead or Customer) real progress through one automation —
 * separate from MarketingAutomation itself so the DEFINITION can be
 * edited without corrupting anyone already mid-sequence, and so a
 * company can see "who is currently in this journey and where."
 */
const enrollmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  automationId: { type: Schema.Types.ObjectId, ref: 'MarketingAutomation', required: true },
  entityType: { type: String, enum: ['Lead', 'Customer'], required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },

  currentStepIndex: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  nextRunAt: { type: Date, required: true },
  lastRunAt: Date,
}, { timestamps: true });

// One active enrollment per entity per automation — re-triggering the same
// event for something already in this journey is a no-op, not a second
// parallel enrollment (see automationService.trigger's own real dedup).
enrollmentSchema.index({ companyId: 1, automationId: 1, entityType: 1, entityId: 1, status: 1 });
enrollmentSchema.index({ companyId: 1, status: 1, nextRunAt: 1 });

module.exports = model('MarketingAutomationEnrollment', enrollmentSchema);
