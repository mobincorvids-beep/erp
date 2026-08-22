/**
 * B2bService — Customer RFQ / tender / bid management (spec §31). Blanket
 * and recurring orders are deliberately NOT a new concept here: a
 * recurring B2B order is exactly what RecurringInvoiceTemplate (see
 * services/recurringInvoiceService.js, added earlier this phase set)
 * already does for any customer — B2B doesn't need its own version.
 * Contract pricing/credit terms reuse a 'customer_price' PricingRule and
 * Customer.creditLimit, both of which already exist. This service covers
 * only the genuinely new piece: tenders and bids.
 */
const CustomerTender = require('../../models/CustomerTender');
const TenderBid = require('../../models/TenderBid');

function createTender(input) {
  const { customerId, title, items } = input;
  if (!customerId || !title) throw new Error('customerId and title are required.');
  if (!items || items.length === 0) throw new Error('At least one item is required.');
  return CustomerTender.create(input);
}

function listTenders(companyId, { status, customerId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;
  return CustomerTender.find(filter).sort({ dueDate: 1 });
}

/** Submits our bid — quotationId is a real, already-priced Sale (saleType: 'quotation'), created through the normal salesOrderService.createQuotation first. */
async function submitBid(input) {
  const { tenderId, quotationId, amount } = input;
  const tender = await CustomerTender.findById(tenderId);
  if (!tender) throw new Error('Tender not found.');
  if (tender.status !== 'open') throw new Error(`Cannot bid on a tender with status "${tender.status}".`);
  if (!(amount > 0)) throw new Error('amount must be greater than zero.');
  return TenderBid.create({ ...input, companyId: tender.companyId });
}

function listBids(tenderId) {
  return TenderBid.find({ tenderId }).populate('quotationId');
}

/** Awards the tender to one real bid — every other bid on the same tender is marked lost, the tender itself moves to 'awarded'. */
async function awardBid(tenderId, bidId) {
  const tender = await CustomerTender.findById(tenderId);
  if (!tender) throw new Error('Tender not found.');
  const winningBid = await TenderBid.findById(bidId);
  if (!winningBid || String(winningBid.tenderId) !== String(tenderId)) throw new Error('Bid not found for this tender.');

  await TenderBid.updateMany({ tenderId, _id: { $ne: bidId } }, { status: 'lost' });
  winningBid.status = 'won';
  await winningBid.save();

  tender.status = 'awarded';
  tender.awardedBidId = bidId;
  await tender.save();

  return { tender, winningBid };
}

module.exports = { createTender, listTenders, submitBid, listBids, awardBid };
