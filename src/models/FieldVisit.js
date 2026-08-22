const { Schema, model } = require('mongoose');

const gpsPointSchema = new Schema({
  lat: Number, lng: Number, recordedAt: Date,
}, { _id: false });

/**
 * A field sales rep's visit to one customer (spec §15) — check-in ->
 * (order/payment/photos/notes/signature) -> check-out, real GPS points
 * at both ends (not a route trace — a full breadcrumb trail is a much
 * larger, separate tracking feature; two real points is what "was the
 * rep actually there" needs). Order creation and payment collection
 * during a visit reuse the real Sale/SalesOrder and CustomerPayment
 * flows already in this app (see fieldSalesService) rather than a
 * parallel visit-scoped transaction record — a visit just LINKS to
 * whichever real Sale/payment happened during it.
 */
const fieldVisitSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  salespersonId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  territoryId: { type: Schema.Types.ObjectId, ref: 'Territory' },

  plannedDate: Date, // set when the visit was route-planned ahead of time; null for an unplanned/walk-in visit
  status: { type: String, enum: ['planned', 'checked_in', 'completed', 'missed'], default: 'planned' },

  checkIn: gpsPointSchema,
  checkOut: gpsPointSchema,

  notes: String,
  photoUrls: [String], // already-uploaded-somewhere URLs — same convention documentService.js's fileUrl already uses; this doesn't attempt binary upload handling either
  signatureUrl: String,

  saleId: { type: Schema.Types.ObjectId, ref: 'Sale' }, // set if an order was created during this visit
  paymentAmount: { type: Number, default: 0 }, // collected during the visit — recorded via the real customerLedgerService payment path, this just tracks what happened on-site
}, { timestamps: true });

fieldVisitSchema.index({ companyId: 1, salespersonId: 1, plannedDate: 1 });
fieldVisitSchema.index({ companyId: 1, customerId: 1, createdAt: -1 });

module.exports = model('FieldVisit', fieldVisitSchema);
