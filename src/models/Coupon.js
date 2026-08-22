const { Schema, model } = require('mongoose');

const couponSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  code: { type: String, required: true },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true }, // percent (0-100) or a fixed currency amount, per `type`

  minPurchase: { type: Number, default: 0 },
  maxDiscount: Number, // caps a percentage coupon's real currency value — unset = uncapped
  usageLimit: Number,  // total redemptions across all customers — unset = unlimited
  usageCount: { type: Number, default: 0 },
  perCustomerLimit: { type: Number, default: 1 },

  productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }], // empty = valid on any product
  branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],   // empty = valid at any branch
  isFirstOrderOnly: { type: Boolean, default: false },

  expiresAt: Date,
  isActive: { type: Boolean, default: true },
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
}, { timestamps: true });

couponSchema.index({ companyId: 1, code: 1 }, { unique: true });

module.exports = model('Coupon', couponSchema);
