/**
 * CommissionService — real commission computed from actual Sale/SaleReturn
 * data (spec §11's own flow: Sales -> Returns -> Discount -> Net Sales ->
 * Gross Profit -> Commission -> Employee Payroll), posted into payroll
 * through the REAL, already-existing, purpose-built hook —
 * hrService.addBonusToDraftPayroll() — rather than a new, parallel payroll
 * mechanism. That function's own doc comment says it exists exactly for
 * "an industry module's commission scheme" to use without hrService
 * needing to know the scheme; this is that scheme.
 */
const Sale = require('../../models/Sale');
const SaleReturn = require('../../models/SaleReturn');
const Product = require('../../models/Product');
const Employee = require('../../models/Employee');
const CommissionPlan = require('../../models/CommissionPlan');
const hrService = require('../hrService');

function createPlan(input) {
  const { rateType, flatPercent, tiers } = input;
  if (rateType === 'flat' && !(flatPercent > 0)) throw new Error('flatPercent must be greater than zero for a flat-rate plan.');
  if (rateType === 'tiered' && (!tiers || tiers.length === 0)) throw new Error('At least one tier is required for a tiered plan.');
  return CommissionPlan.create(input);
}

function listPlans(companyId, { salespersonId } = {}) {
  const filter = { companyId, isActive: true };
  if (salespersonId !== undefined) filter.salespersonId = salespersonId;
  return CommissionPlan.find(filter);
}

/** A salesperson's own plan wins; the company's default (salespersonId: null) plan is the fallback; no plan configured at all returns null, not an error — commission is opt-in. */
async function resolvePlanFor(companyId, salespersonId) {
  const specific = await CommissionPlan.findOne({ companyId, salespersonId, isActive: true });
  if (specific) return specific;
  return CommissionPlan.findOne({ companyId, salespersonId: null, isActive: true });
}

async function findVariant(product, variantId) {
  if (!variantId) return null;
  return product.variants.id ? product.variants.id(variantId) : product.variants.find((v) => String(v._id) === String(variantId));
}

/**
 * Real numbers, not estimates: gross sales from actual completed Sale
 * documents for this salesperson in the period, less actual SaleReturn
 * amounts against those same sales — the exact "Sales -> Returns -> Net
 * Sales" chain the spec names. Gross profit additionally nets out real
 * product cost per line, the same cost-lookup approach cpqService.evaluateMargin
 * already established (current Product/variant costPrice, since a Sale
 * doesn't snapshot cost at the time of sale).
 */
async function calculateCommission(companyId, salespersonId, periodStart, periodEnd) {
  const plan = await resolvePlanFor(companyId, salespersonId);
  if (!plan) return { salespersonId, netSales: 0, grossProfit: 0, commissionAmount: 0, plan: null };

  const sales = await Sale.find({
    companyId, userId: salespersonId, status: 'completed',
    createdAt: { $gte: periodStart, $lte: periodEnd },
  });
  const saleIds = sales.map((s) => s._id);

  const returns = saleIds.length > 0
    ? await SaleReturn.find({ saleId: { $in: saleIds } })
    : [];
  const returnsTotal = returns.reduce((sum, r) => sum + r.totalAmount, 0);
  const grossSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const netSales = Math.round((grossSales - returnsTotal) * 100) / 100;

  let basisAmount = netSales;
  if (plan.basis === 'gross_profit') {
    let totalCost = 0;
    for (const sale of sales) {
      for (const item of sale.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        const variant = await findVariant(product, item.variantId);
        const unitCost = (variant && variant.costPrice != null) ? variant.costPrice : product.costPrice;
        totalCost += (unitCost || 0) * item.quantity;
      }
    }
    basisAmount = Math.round((netSales - totalCost) * 100) / 100;
  }

  let commissionAmount = 0;
  if (plan.rateType === 'flat') {
    commissionAmount = Math.round(basisAmount * (plan.flatPercent / 100) * 100) / 100;
  } else {
    // The highest tier whose minAmount the basis amount actually clears —
    // applied to the WHOLE basis amount (a flat rate at that tier, not a
    // graduated/marginal bracket calculation like income tax brackets).
    // A defensible, simpler reading of the spec's one-line "Tier
    // commission" item, stated directly rather than silently assumed.
    const tier = [...plan.tiers].sort((a, b) => b.minAmount - a.minAmount).find((t) => basisAmount >= t.minAmount);
    commissionAmount = tier ? Math.round(basisAmount * (tier.percent / 100) * 100) / 100 : 0;
  }

  return { salespersonId, netSales, grossProfitBasis: plan.basis === 'gross_profit' ? basisAmount : null, commissionAmount, plan };
}

/** The actual "-> Employee Payroll" hand-off. Requires the salesperson (a User) to have a linked Employee record — a commission with nobody to pay it to is a real, honest error, not a silent no-op. */
async function postToPayroll(companyId, payrollRunId, salespersonId, periodStart, periodEnd) {
  const employee = await Employee.findOne({ companyId, userId: salespersonId });
  if (!employee) throw new Error('This salesperson has no linked Employee record — commission cannot be posted to a payroll run without one.');

  const { commissionAmount, netSales, plan } = await calculateCommission(companyId, salespersonId, periodStart, periodEnd);
  if (commissionAmount <= 0) return { posted: false, commissionAmount: 0, reason: 'No commission earned for this period.' };

  const note = `Sales commission (${plan.name}): ${commissionAmount} on net sales of ${netSales}.`;
  const run = await hrService.addBonusToDraftPayroll(payrollRunId, employee._id, commissionAmount, note);
  return { posted: true, commissionAmount, payrollRun: run };
}

module.exports = { createPlan, listPlans, resolvePlanFor, calculateCommission, postToPayroll };
