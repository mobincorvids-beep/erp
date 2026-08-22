/**
 * ForecastService — rule-based (explicitly not ML, same posture
 * aiInsightsService already holds to elsewhere in this app) sales
 * forecasting (spec §13): a real pipeline-weighted forecast from open
 * Opportunity records, and a real historical trend from actual completed
 * Sale totals. No prediction model, no training data — genuine arithmetic
 * over real, current data, stated as such rather than oversold.
 */
const Opportunity = require('../../models/Opportunity');
const Sale = require('../../models/Sale');

/**
 * Best case: every open opportunity closes (the ceiling). Most likely:
 * each opportunity's own expectedValue weighted by its own probability —
 * the standard weighted-pipeline forecast. Worst case: only the
 * high-confidence deals (probability >= 70) count at all, and even those
 * count in full — a deliberately conservative floor, not a further
 * discount on top of an already-probability-weighted number.
 */
async function pipelineForecast(companyId, { salespersonId, territoryId } = {}) {
  const filter = { companyId, stage: { $nin: ['won', 'lost'] } };
  if (salespersonId) filter.salespersonId = salespersonId;
  if (territoryId) filter.territoryId = territoryId;
  const opportunities = await Opportunity.find(filter);

  const bestCase = opportunities.reduce((sum, o) => sum + o.expectedValue, 0);
  const mostLikely = opportunities.reduce((sum, o) => sum + o.expectedValue * (o.probability / 100), 0);
  const worstCase = opportunities.filter((o) => o.probability >= 70).reduce((sum, o) => sum + o.expectedValue, 0);

  return {
    opportunityCount: opportunities.length,
    bestCase: Math.round(bestCase * 100) / 100,
    mostLikely: Math.round(mostLikely * 100) / 100,
    worstCase: Math.round(worstCase * 100) / 100,
  };
}

/**
 * A real trailing average over actual completed sales, one real month at
 * a time — not a fitted trend line or a seasonal model, just the honest
 * arithmetic mean of what actually happened, projected forward one
 * period. Genuinely useful as a floor-level sanity check against the
 * pipeline forecast above, not a claim of statistical rigor it doesn't have.
 */
async function historicalForecast(companyId, monthsBack = 6) {
  const now = new Date();
  const months = [];
  for (let i = monthsBack; i >= 1; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    months.push({ start, end, label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` });
  }

  const monthlyTotals = [];
  for (const m of months) {
    const sales = await Sale.find({ companyId, status: 'completed', createdAt: { $gte: m.start, $lte: m.end } });
    monthlyTotals.push({ month: m.label, total: Math.round(sales.reduce((s, sale) => s + sale.totalAmount, 0) * 100) / 100 });
  }

  const average = monthlyTotals.length > 0
    ? Math.round((monthlyTotals.reduce((s, m) => s + m.total, 0) / monthlyTotals.length) * 100) / 100
    : 0;

  return { monthlyTotals, projectedNextMonth: average };
}

module.exports = { pipelineForecast, historicalForecast };
