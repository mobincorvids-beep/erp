const { Schema, model } = require('mongoose');

/**
 * A customer's own RFQ/tender to US (spec §31 B2B Sales) — the inverse
 * of models/RFQ.js (which is OUR outbound RFQ to suppliers). Genuinely a
 * different direction, not the same model reused: here we're the vendor
 * responding with a bid, not soliciting one.
 */
const customerTenderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  title: { type: String, required: true },
  description: String,
  items: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    description: String,
    quantity: { type: Number, required: true },
  }],
  dueDate: Date,
  status: { type: String, enum: ['open', 'awarded', 'lost', 'cancelled'], default: 'open' },
  awardedBidId: { type: Schema.Types.ObjectId, ref: 'TenderBid' },
}, { timestamps: true });

module.exports = model('CustomerTender', customerTenderSchema);
