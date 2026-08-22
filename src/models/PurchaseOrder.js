const { Schema, model } = require('mongoose');

const poItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantityOrdered: { type: Number, required: true },
  quantityReceived: { type: Number, default: 0 },
  unitCost: { type: Number, required: true },
}, { timestamps: true });

const purchaseOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  requisitionId: { type: Schema.Types.ObjectId, ref: 'PurchaseRequisition', default: null },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null }, // tags this PO for job costing; a ProjectCost is auto-created per GRN received against it
  poNumber: { type: String, required: true, unique: true },
  status: { type: String, default: 'draft' }, // draft, ordered, partially_received, received, cancelled
  items: [poItemSchema],
  subtotal: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 }, // set to totalAmount once received; reduced by SupplierPayment allocations

  // Optional early-payment trade-credit terms (spec §10 "early-payment
  // discount") — see services/earlyPaymentDiscountService.js. Unset by
  // default, meaning every existing PO and every existing caller of
  // purchaseService.createPurchaseOrder is completely unaffected.
  paymentTermsDays: Number,
  earlyPaymentDiscountPercent: Number,
  earlyPaymentDiscountDays: Number,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('PurchaseOrder', purchaseOrderSchema);
