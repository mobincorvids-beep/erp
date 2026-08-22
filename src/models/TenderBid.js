const { Schema, model } = require('mongoose');

// Our own bid against a CustomerTender — links to a real Quotation (a
// Sale document, saleType: 'quotation') for the actual priced offer
// rather than duplicating pricing here, the same "a quotation is a Sale
// document" reuse Opportunity.quotationIds already established.
const tenderBidSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  tenderId: { type: Schema.Types.ObjectId, ref: 'CustomerTender', required: true },
  quotationId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true },
  amount: { type: Number, required: true },
  notes: String,
  status: { type: String, enum: ['submitted', 'won', 'lost'], default: 'submitted' },
}, { timestamps: true });

module.exports = model('TenderBid', tenderBidSchema);
