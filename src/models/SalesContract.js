const { Schema, model } = require('mongoose');

const contractLineSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  description: String,
  quantity: Number,
  contractPrice: Number,
}, { _id: false });

/**
 * A sales contract (spec §33) — real terms, real approval (reuses the
 * core Workflow Engine via approvalService, entityType 'SalesContract',
 * the same pattern PurchaseOrder approval already uses), real attachments
 * (reuses the Document engine, entityType 'SalesContract' — no embedded
 * file schema here). Digital signature CAPTURE is explicitly out of
 * scope, the same honest boundary Document Management's own README
 * already draws for e-signatures generally — `signedAt` records that a
 * signature happened by whatever real-world process, not that this app
 * verified one cryptographically.
 */
const salesContractSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  contractNumber: { type: String, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  lines: [contractLineSchema],
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  paymentTerms: String,
  deliveryTerms: String,
  sla: String,

  status: { type: String, enum: ['draft', 'pending_approval', 'active', 'expired', 'terminated'], default: 'draft' },
  approvalRequestId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest' },
  signedAt: Date,

  // Amendments — a real, append-only history rather than overwriting the
  // original terms, so "what did we actually agree to on date X" stays
  // answerable, the same reasoning documentService's own version history
  // already established.
  amendments: [{ note: String, amendedAt: { type: Date, default: Date.now }, userId: { type: Schema.Types.ObjectId, ref: 'User' } }],
}, { timestamps: true });

salesContractSchema.index({ companyId: 1, contractNumber: 1 }, { unique: true });
salesContractSchema.index({ companyId: 1, customerId: 1 });

module.exports = model('SalesContract', salesContractSchema);
