/**
 * PartnerService — dealer/distributor/agent/reseller/franchise management
 * (spec §30). Orders, stock movements, and returns are NOT reimplemented
 * here: a partner order IS a normal SalesOrder against the partner's
 * linked Customer (salesOrderService), a partner statement IS that same
 * customer's real ledger (customerLedgerService.ledger), and contract
 * pricing IS a 'customer_price' PricingRule targeting that customerId
 * (pricingEngineService) — this service only adds the genuinely new
 * pieces: partner identity/KYC, commission, and rebates.
 */
const Partner = require('../../models/Partner');
const Customer = require('../../models/Customer');
const Sale = require('../../models/Sale');
const accountingService = require('../accountingService');
const defaultAccountsService = require('../defaultAccountsService');
const customerLedgerService = require('../customerLedgerService');

/** Creates the linked Customer (if one wasn't supplied) and the Partner record together — a partner without a real Customer to buy against isn't a usable partner. */
async function createPartner(input) {
  const { companyId, customerId, name, type } = input;
  if (!name || !type) throw new Error('name and type are required.');

  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId) {
    const customer = await Customer.create({ companyId, name, tags: [`channel:${type}`] });
    resolvedCustomerId = customer._id;
  }

  return Partner.create({ ...input, companyId, customerId: resolvedCustomerId });
}

function listPartners(companyId, { type, territoryId } = {}) {
  const filter = { companyId };
  if (type) filter.type = type;
  if (territoryId) filter.territoryId = territoryId;
  return Partner.find(filter).populate('customerId', 'name phone email creditLimit');
}

async function updatePartner(partnerId, patch) {
  delete patch.customerId; // the customer link is set once at creation, not silently reassignable through a generic patch
  const partner = await Partner.findByIdAndUpdate(partnerId, patch, { new: true });
  if (!partner) throw new Error('Partner not found.');
  return partner;
}

/** Real commission on this partner's own actual completed sales in a period — same shape as commissionService.calculateCommission, scoped to one customerId instead of one salespersonId (a partner isn't a User, so it can't reuse that function directly). */
async function calculateCommission(companyId, partnerId, periodStart, periodEnd) {
  const partner = await Partner.findById(partnerId);
  if (!partner) throw new Error('Partner not found.');
  if (!(partner.commissionPercent > 0)) return { partnerId, netSales: 0, commissionAmount: 0 };

  const sales = await Sale.find({ companyId, customerId: partner.customerId, status: 'completed', createdAt: { $gte: periodStart, $lte: periodEnd } });
  const netSales = Math.round(sales.reduce((sum, s) => sum + s.totalAmount, 0) * 100) / 100;
  const commissionAmount = Math.round(netSales * (partner.commissionPercent / 100) * 100) / 100;
  return { partnerId, netSales, commissionAmount };
}

/**
 * A real rebate/credit — a genuine balanced voucher (Dr Rebate Expense,
 * Cr this partner's own Accounts Receivable), which is what actually
 * reduces what they owe, exactly the same double-entry shape
 * earlyPaymentDiscountService.payWithEarlyDiscount() already established
 * for a conceptually similar "give real money back without it being a
 * cash payment" case.
 */
async function recordRebate(companyId, partnerId, { amount, rebateExpenseAccountId, note, userId }) {
  if (!(amount > 0)) throw new Error('amount must be greater than zero.');
  const partner = await Partner.findById(partnerId);
  if (!partner) throw new Error('Partner not found.');

  const receivableAccountId = await defaultAccountsService.resolve(companyId, 'accountsReceivableId');
  const voucher = await accountingService.postVoucher({
    companyId, type: 'journal', date: new Date(),
    narration: `Partner rebate — ${partner.name}${note ? `: ${note}` : ''}`,
    entries: [
      { accountId: rebateExpenseAccountId, debit: amount, credit: 0 },
      { accountId: receivableAccountId, debit: 0, credit: amount },
    ],
    referenceType: 'Partner', referenceId: partner._id, userId,
  });
  return voucher;
}

function statement(partnerId) {
  return Partner.findById(partnerId).then((partner) => {
    if (!partner) throw new Error('Partner not found.');
    return customerLedgerService.ledger(partner.customerId);
  });
}

module.exports = { createPartner, listPartners, updatePartner, calculateCommission, recordRebate, statement };
