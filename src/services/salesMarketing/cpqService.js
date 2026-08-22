/**
 * CpqService — the "Approval for low-margin quotes" half of Configure-
 * Price-Quote (spec §8), plus the general discount-approval ladder
 * (spec §10's own worked example: <5% salesperson, 5-10% sales manager,
 * 10-20% branch manager, >20% director).
 *
 * Genuinely reuses the existing multi-step Workflow Engine rather than
 * building a second, parallel approval system — the same discipline this
 * codebase already applied to Document approval. A company configures a
 * `WorkflowDefinition` with `entityType: 'DiscountApproval'` and steps
 * whose `minAmount` is read as a DISCOUNT PERCENTAGE for this specific
 * entityType (0-100), not a currency amount — `approvalService.request()`
 * already just compares `amount >= step.minAmount` generically, so this
 * costs zero changes to the approval engine itself, only a documented
 * convention for what "amount" means for this one entityType.
 *
 * Configuration-free by default: with no WorkflowDefinition configured for
 * 'DiscountApproval', requestApproval() still works (single implicit
 * step, same fallback every other entityType already gets) — a company
 * that hasn't set up discount tiers isn't blocked, just isn't gated.
 */
const Sale = require('../../models/Sale');
const Product = require('../../models/Product');
const Company = require('../../models/Company');
const approvalService = require('../approvalService');

function findVariant(product, variantId) {
  if (!variantId) return null;
  return product.variants.id ? product.variants.id(variantId) : product.variants.find((v) => String(v._id) === String(variantId));
}

/**
 * Read-only — computes real numbers, requests nothing. Cost is looked up
 * fresh from the current Product/variant costPrice (not a snapshot on the
 * Sale, since Sale doesn't carry cost — a quotation is a commitment on
 * price, not on cost basis, matching how this app has always treated
 * quotations as pre-transaction documents).
 */
async function evaluateMargin(saleId) {
  const sale = await Sale.findById(saleId);
  if (!sale) throw new Error('Sale/quotation not found.');

  let totalCost = 0;
  for (const item of sale.items) {
    const product = await Product.findById(item.productId);
    if (!product) continue; // a product deleted after the quote was made — cost can't be known, skip rather than throw and block the read
    const variant = findVariant(product, item.variantId);
    const unitCost = (variant && variant.costPrice != null) ? variant.costPrice : product.costPrice;
    totalCost += (unitCost || 0) * item.quantity;
  }

  const revenue = sale.subtotal - sale.discountAmount; // pre-tax net — tax isn't a margin input
  const marginPercent = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;
  const discountPercent = sale.subtotal > 0 ? (sale.discountAmount / sale.subtotal) * 100 : 0;

  const company = await Company.findById(sale.companyId);
  const minMarginPercent = company?.defaultMinMarginPercent;
  const belowMinMargin = minMarginPercent != null && marginPercent < minMarginPercent;

  return { saleId: sale._id, totalCost, revenue, marginPercent, discountPercent, minMarginPercent, belowMinMargin };
}

/** The actual gate — routes to whoever the company's DiscountApproval workflow says should approve a discount of this size. */
async function requestDiscountApproval(saleId, userId) {
  const { discountPercent } = await evaluateMargin(saleId);
  return approvalService.request({
    companyId: (await Sale.findById(saleId)).companyId,
    entityType: 'DiscountApproval',
    entityId: saleId,
    requestedBy: userId,
    amount: discountPercent,
    note: `Discount of ${discountPercent.toFixed(2)}% on quotation.`,
  });
}

module.exports = { evaluateMargin, requestDiscountApproval };
