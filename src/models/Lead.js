const { Schema, model } = require('mongoose');
const { LEAD_SOURCES, LEAD_STATUSES } = require('../constants/salesMarketing');

const leadSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  leadNumber: { type: String, required: true },

  name: { type: String, required: true },
  company: String,
  contactPerson: String,
  phone: String,
  whatsapp: String,
  email: String,
  address: String,
  city: String,
  industry: String,
  productInterest: String,
  estimatedValue: { type: Number, default: 0 },

  source: { type: String, enum: LEAD_SOURCES, required: true },
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
  salespersonId: { type: Schema.Types.ObjectId, ref: 'User' },
  territoryId: { type: Schema.Types.ObjectId, ref: 'Territory' },

  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  // Rating is DERIVED (see leadService.rescoreLead), not hand-set — kept as
  // a stored field anyway so list views/reports can filter/sort on it
  // without recomputing the score for every row.
  score: { type: Number, default: 0 },
  rating: { type: String, enum: ['hot', 'warm', 'cold'], default: 'cold' },

  status: { type: String, enum: LEAD_STATUSES, default: 'new' },
  lostReason: String, // only meaningful when status === 'lost' — a real, reportable field (spec §38 "Lost leads")

  nextFollowUpAt: Date,
  notes: String,

  // Set once a Lead converts — see leadService.convertToOpportunity. A
  // Lead is never deleted on conversion (the source record for
  // attribution — spec §37 — has to survive), just linked forward and
  // status-flipped.
  convertedCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  convertedOpportunityId: { type: Schema.Types.ObjectId, ref: 'Opportunity' },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

leadSchema.index({ companyId: 1, leadNumber: 1 }, { unique: true });
leadSchema.index({ companyId: 1, status: 1 });
leadSchema.index({ companyId: 1, salespersonId: 1, status: 1 });
leadSchema.index({ companyId: 1, source: 1 });
leadSchema.index({ companyId: 1, campaignId: 1 });

module.exports = model('Lead', leadSchema);
