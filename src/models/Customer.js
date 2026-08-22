const { Schema, model } = require('mongoose');

const customerSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  priceGroupId: { type: Schema.Types.ObjectId, ref: 'PriceGroup' },
  territoryId: { type: Schema.Types.ObjectId, ref: 'Territory' }, // completes the spec's Territory -> Salesperson -> Customers -> Leads -> Opportunities chain (Lead/Opportunity already carry this — see models/Lead.js, models/Opportunity.js)
  assignedSalespersonId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  phone: String,
  email: String,
  address: String,
  creditLimit: { type: Number, default: 0 },
  openingBalance: { type: Number, default: 0 }, // +ve = customer owes company
  loyaltyPoints: { type: Number, default: 0 },
  // Free-text segmentation — "VIP", "Wholesale", "Birthday-March" etc. Kept
  // simple (tags, not a rules engine) since campaign/report targeting just
  // needs to filter by these; a full segment-builder is a UI concern, not
  // a schema one.
  tags: [{ type: String }],
}, { timestamps: true });

customerSchema.index({ companyId: 1, tags: 1 });

module.exports = model('Customer', customerSchema);
