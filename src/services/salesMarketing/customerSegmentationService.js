/**
 * CustomerSegmentationService — the BEHAVIORAL half of spec §25's
 * automatic segments (VIP, High Value, Frequent Buyers, Inactive,
 * At-Risk, New) computed from real purchase history, applied as real
 * `Customer.tags` — the exact same tag mechanism crmService.findBySegment()
 * and campaign targeting already read, so a computed segment is
 * immediately usable everywhere a manual tag already is, not a second,
 * parallel segmentation concept. Wholesale/Retail/Dealers/Distributors/
 * Corporate are deliberately NOT computed here — those are business
 * classifications a company assigns (already possible via
 * crmService.addTags), not something derivable from transaction history,
 * and guessing at them from behavior would be a real, wrong claim.
 */
const Customer = require('../../models/Customer');
const Sale = require('../../models/Sale');

const SEGMENT_TAGS = {
  vip: 'segment:vip',
  highValue: 'segment:high-value',
  frequentBuyer: 'segment:frequent-buyer',
  inactive: 'segment:inactive',
  atRisk: 'segment:at-risk',
  newCustomer: 'segment:new',
};
const ALL_SEGMENT_TAGS = Object.values(SEGMENT_TAGS);

const DAY = 24 * 60 * 60 * 1000;

/**
 * Recomputes ONE customer's real segment tags from actual Sale history —
 * removes every prior segment tag and re-applies only what's currently
 * true, so a customer who stops buying eventually loses 'vip' rather than
 * keeping it forever from one good year.
 */
async function recomputeSegments(companyId, customerId) {
  const customer = await Customer.findOne({ _id: customerId, companyId });
  if (!customer) throw new Error('Customer not found.');

  const now = Date.now();
  const sales = await Sale.find({ companyId, customerId, status: 'completed' }).sort({ createdAt: 1 });

  const tags = new Set((customer.tags || []).filter((t) => !ALL_SEGMENT_TAGS.includes(t)));

  if (sales.length === 0) {
    tags.add(SEGMENT_TAGS.newCustomer);
  } else {
    const totalSpend = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const lastSale = sales[sales.length - 1];
    const daysSinceLastPurchase = (now - lastSale.createdAt.getTime()) / DAY;
    const daysSinceFirstPurchase = (now - sales[0].createdAt.getTime()) / DAY;
    const purchasesLast90Days = sales.filter((s) => (now - s.createdAt.getTime()) / DAY <= 90).length;

    if (daysSinceFirstPurchase <= 30) tags.add(SEGMENT_TAGS.newCustomer);
    if (totalSpend >= 1000000) tags.add(SEGMENT_TAGS.vip);
    else if (totalSpend >= 250000) tags.add(SEGMENT_TAGS.highValue);
    if (purchasesLast90Days >= 5) tags.add(SEGMENT_TAGS.frequentBuyer);

    // At-risk: WAS a real, regular customer (more than a couple of
    // orders) and has now gone quiet for a while — genuinely different
    // from 'inactive', which is a longer, harder cutoff. Checked in this
    // order (at-risk before inactive) so a long-gone customer gets the
    // more specific, more severe tag, not both.
    if (daysSinceLastPurchase > 180) tags.add(SEGMENT_TAGS.inactive);
    else if (daysSinceLastPurchase > 60 && sales.length >= 3) tags.add(SEGMENT_TAGS.atRisk);
  }

  customer.tags = [...tags];
  await customer.save();
  return customer;
}

/** Used by a queue sweep (see queue/jobs.js) — every active customer at a company, recomputed once. Real per-customer failures don't abort the batch. */
async function recomputeAllSegments(companyId) {
  const customers = await Customer.find({ companyId }, '_id');
  let updated = 0;
  for (const c of customers) {
    await recomputeSegments(companyId, c._id).then(() => { updated += 1; }).catch(() => {});
  }
  return { updated, total: customers.length };
}

module.exports = { recomputeSegments, recomputeAllSegments, SEGMENT_TAGS };
