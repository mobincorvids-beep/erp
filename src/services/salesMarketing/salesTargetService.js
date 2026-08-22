/**
 * SalesTargetService — targets/quotas and real achievement-vs-actual
 * (spec §12), computed from the exact same Sale collection every other
 * report in this app reads, never a separately tracked "actual" number.
 */
const SalesTarget = require('../../models/SalesTarget');
const Sale = require('../../models/Sale');

function setTarget(input) {
  const { targetValue } = input;
  if (!(targetValue > 0)) throw new Error('targetValue must be greater than zero.');
  return SalesTarget.create(input);
}

function listTargets(companyId, { salespersonId, branchId, territoryId } = {}) {
  const filter = { companyId };
  if (salespersonId) filter.salespersonId = salespersonId;
  if (branchId) filter.branchId = branchId;
  if (territoryId) filter.territoryId = territoryId;
  return SalesTarget.find(filter).sort({ periodStart: -1 });
}

/** Actual revenue for exactly this target's own scope and period — whichever ONE of salesperson/branch/territory/product/category the target was set against. */
async function achievement(targetId) {
  const target = await SalesTarget.findById(targetId);
  if (!target) throw new Error('Sales target not found.');

  const filter = {
    companyId: target.companyId, status: 'completed',
    createdAt: { $gte: target.periodStart, $lte: target.periodEnd },
  };
  if (target.salespersonId) filter.userId = target.salespersonId;
  if (target.branchId) filter.branchId = target.branchId;
  // territory/product/category scoping requires touching Sale.items or a
  // Customer->Territory join this schema doesn't carry on Sale directly —
  // left as a real, stated limitation rather than a wrong number: those
  // two scopes report `actual: null` instead of guessing.
  const scopedByTerritoryProductOrCategory = target.territoryId || target.productId || target.categoryId;

  if (scopedByTerritoryProductOrCategory && !target.salespersonId && !target.branchId) {
    return { target, actual: null, achievementPercent: null, note: 'Territory/product/category-scoped achievement is not yet computed — Sale does not carry these fields directly.' };
  }

  const sales = await Sale.find(filter);
  const actual = Math.round(sales.reduce((sum, s) => sum + s.totalAmount, 0) * 100) / 100;
  const achievementPercent = target.targetValue > 0 ? Math.round((actual / target.targetValue) * 10000) / 100 : null;

  return { target, actual, achievementPercent };
}

module.exports = { setTarget, listTargets, achievement };
