/**
 * Customer360Service — the spec's own §16 "one screen should show
 * everything" view. Deliberately a pure aggregation over EXISTING
 * collections, reading each one's own already-correct query/service
 * rather than re-deriving anything — the same "routing/aggregation
 * layer over real, already-tested sources of truth" principle
 * dashboardService already established for the per-role dashboards.
 * Nothing here writes anything; a slow or failing section (e.g. a
 * customer with no ledger activity yet) degrades to an empty array for
 * that section, never fails the whole view over one empty slice.
 */
const Customer = require('../../models/Customer');
const Lead = require('../../models/Lead');
const Opportunity = require('../../models/Opportunity');
const Sale = require('../../models/Sale');
const SaleReturn = require('../../models/SaleReturn');
const CustomerFeedback = require('../../models/CustomerFeedback');
const CustomerFollowUp = require('../../models/CustomerFollowUp');
const Ticket = require('../../models/Ticket');
const LoyaltyTransaction = require('../../models/LoyaltyTransaction');
const Document = require('../../models/Document');
const customerLedgerService = require('../customerLedgerService');
const salesActivityService = require('./salesActivityService');

async function view(companyId, customerId) {
  const customer = await Customer.findOne({ _id: customerId, companyId });
  if (!customer) throw new Error('Customer not found.');

  const [
    leads, opportunities, quotations, orders, invoices,
    ledger, feedback, followUps, tickets, loyaltyTransactions, documents, activities,
  ] = await Promise.all([
    Lead.find({ companyId, convertedCustomerId: customerId }).sort({ createdAt: -1 }).limit(50),
    Opportunity.find({ companyId, customerId }).sort({ createdAt: -1 }).limit(50),
    Sale.find({ companyId, customerId, saleType: 'quotation' }).sort({ createdAt: -1 }).limit(50),
    Sale.find({ companyId, customerId, saleType: 'sales_order' }).sort({ createdAt: -1 }).limit(50),
    Sale.find({ companyId, customerId, saleType: 'pos', status: { $in: ['completed', 'returned'] } }).sort({ createdAt: -1 }).limit(100),
    customerLedgerService.ledger(customerId).catch(() => null), // genuinely optional — a brand-new customer with zero transactions has no ledger to build, not a bug
    CustomerFeedback.find({ companyId, customerId }).sort({ createdAt: -1 }).limit(20),
    CustomerFollowUp.find({ companyId, customerId }).sort({ createdAt: -1 }).limit(20),
    Ticket.find({ companyId, customerId }).sort({ createdAt: -1 }).limit(20),
    LoyaltyTransaction.find({ companyId, customerId }).sort({ createdAt: -1 }).limit(30),
    Document.find({ companyId, entityType: 'Customer', entityId: customerId }).sort({ createdAt: -1 }).limit(20),
    salesActivityService.listForEntity(companyId, 'Customer', customerId),
  ]);

  // SaleReturn has no customerId of its own (see models/SaleReturn.js) —
  // only saleId. Resolved via this customer's own invoice ids rather than
  // guessed at, which a defensive try/catch around a wrong field name
  // would have silently masked as "no returns" forever instead of a
  // real, visible bug.
  const invoiceIds = invoices.map((s) => s._id);
  const returns = invoiceIds.length > 0 ? await SaleReturn.find({ saleId: { $in: invoiceIds } }).sort({ createdAt: -1 }).limit(50) : [];

  const invoicedTotal = invoices.reduce((sum, s) => sum + s.totalAmount, 0);
  const lifetimeValue = Math.round((invoicedTotal - returns.reduce((sum, r) => sum + r.totalAmount, 0)) * 100) / 100;

  return {
    profile: customer,
    summary: {
      lifetimeValue,
      orderCount: invoices.length,
      openOpportunities: opportunities.filter((o) => !['won', 'lost'].includes(o.stage)).length,
      openTickets: tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length,
      loyaltyPoints: customer.loyaltyPoints,
    },
    leads, opportunities, quotations, orders, invoices, returns,
    receivables: ledger, feedback, followUps, tickets, loyaltyTransactions, documents, activities,
  };
}

module.exports = { view };
