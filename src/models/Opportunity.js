const { Schema, model } = require('mongoose');
const { OPPORTUNITY_STAGES } = require('../constants/salesMarketing');

const opportunityProductSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  description: String, // free text when no exact catalog product is chosen yet — an opportunity can exist before CPQ has configured anything
  quantity: { type: Number, default: 1 },
  estimatedUnitPrice: { type: Number, default: 0 },
}, { _id: false });

const opportunitySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  opportunityNumber: { type: String, required: true },

  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  contactPerson: String,
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' }, // set when converted from a Lead — see leadService.convertToOpportunity

  products: [opportunityProductSchema],
  expectedValue: { type: Number, required: true, default: 0 },
  expectedMargin: Number, // percentage — checked against a company's minimum-margin pricing rule at quote time (see pricingEngineService)
  probability: { type: Number, default: 10, min: 0, max: 100 },
  expectedClosingDate: Date,

  salespersonId: { type: Schema.Types.ObjectId, ref: 'User' },
  territoryId: { type: Schema.Types.ObjectId, ref: 'Territory' },
  source: String,
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
  competitor: String,

  stage: { type: String, enum: OPPORTUNITY_STAGES, default: 'new' },
  lostReason: String,
  nextAction: String,
  lastActivityAt: Date, // bumped by salesActivityService whenever a SalesActivity is logged against this opportunity — powers "stage aging" / "no activity in N days" reports without a separate query over SalesActivity every time

  // A "quotation" here IS a Sale document (saleType: 'quotation' — see
  // models/Sale.js), not a separate model — an opportunity can have
  // several quotation revisions (Sale docs) before one is accepted.
  quotationIds: [{ type: Schema.Types.ObjectId, ref: 'Sale' }],
  wonSaleId: { type: Schema.Types.ObjectId, ref: 'Sale' }, // set once the winning quotation actually converts to a real, completed sale — the attribution chain's final link (spec §37)

  notes: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

opportunitySchema.index({ companyId: 1, opportunityNumber: 1 }, { unique: true });
opportunitySchema.index({ companyId: 1, stage: 1 });
opportunitySchema.index({ companyId: 1, salespersonId: 1, stage: 1 });
opportunitySchema.index({ companyId: 1, customerId: 1 });
opportunitySchema.index({ companyId: 1, campaignId: 1 });

module.exports = model('Opportunity', opportunitySchema);
