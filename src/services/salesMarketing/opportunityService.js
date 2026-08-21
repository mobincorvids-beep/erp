/**
 * OpportunityService — the New→Qualification→Discovery→Proposal→
 * Negotiation→Approval→Won/Lost pipeline (spec §4), plus the point where
 * an opportunity actually becomes a real, priced quotation.
 */
const Opportunity = require('../../models/Opportunity');
const Lead = require('../../models/Lead');
const { nextDocumentNumber } = require('../numberingService');
const { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_DEFAULT_PROBABILITY } = require('../../constants/salesMarketing');

async function createOpportunity(input) {
  const { companyId, customerId, expectedValue } = input;
  if (!customerId) throw new Error('customerId is required — an opportunity always belongs to a real customer.');
  return Opportunity.create({
    ...input,
    companyId, customerId,
    expectedValue: expectedValue || 0,
    opportunityNumber: nextDocumentNumber('OPP'),
  });
}

function listOpportunities(companyId, { stage, salespersonId, territoryId, customerId, campaignId } = {}) {
  const filter = { companyId };
  if (stage) filter.stage = stage;
  if (salespersonId) filter.salespersonId = salespersonId;
  if (territoryId) filter.territoryId = territoryId;
  if (customerId) filter.customerId = customerId;
  if (campaignId) filter.campaignId = campaignId;
  return Opportunity.find(filter).sort({ updatedAt: -1 }).limit(500);
}

/** Grouped by stage for a Kanban board — one query, one pass, not N queries (one per column) from the client. */
async function kanban(companyId, { salespersonId, territoryId } = {}) {
  const filter = { companyId, stage: { $nin: ['won', 'lost'] } };
  if (salespersonId) filter.salespersonId = salespersonId;
  if (territoryId) filter.territoryId = territoryId;
  const opportunities = await Opportunity.find(filter).sort({ updatedAt: -1 }).limit(1000);

  const columns = {};
  OPPORTUNITY_STAGES.filter((s) => s !== 'won' && s !== 'lost').forEach((s) => { columns[s] = []; });
  for (const opp of opportunities) (columns[opp.stage] || (columns[opp.stage] = [])).push(opp);
  return columns;
}

/**
 * Moving stages auto-sets the DEFAULT probability for the new stage —
 * explicitly only when the caller doesn't pass their own `probability`,
 * since a rep's own read on a specific deal should always be able to
 * override the generic default (see the honesty note on
 * OPPORTUNITY_STAGE_DEFAULT_PROBABILITY in constants/salesMarketing.js).
 */
async function updateStage(opportunityId, newStage, { probability, lostReason, userId } = {}) {
  if (!OPPORTUNITY_STAGES.includes(newStage)) throw new Error(`Invalid opportunity stage: ${newStage}`);
  const opp = await Opportunity.findById(opportunityId);
  if (!opp) throw new Error('Opportunity not found.');

  if (newStage === 'lost' && !lostReason) throw new Error('lostReason is required when marking an opportunity lost.');

  opp.stage = newStage;
  opp.probability = probability !== undefined ? probability : OPPORTUNITY_STAGE_DEFAULT_PROBABILITY[newStage];
  if (newStage === 'lost') opp.lostReason = lostReason;
  opp.lastActivityAt = new Date();
  await opp.save();

  if (opp.leadId && (newStage === 'won' || newStage === 'lost')) {
    await Lead.findByIdAndUpdate(opp.leadId, { status: newStage, ...(newStage === 'lost' ? { lostReason } : {}) });
  }
  return opp;
}

/**
 * CPQ hand-off point (spec §8): the opportunity's own `products` field is
 * an estimate, not authoritative enough to bill from (no variant/warehouse
 * resolved yet) — the caller supplies a real, fully-specified quotation
 * (variantId/warehouseId/pricing, same shape salesOrderService.createQuotation
 * always requires) at the moment it's actually configured, and this just
 * links the resulting Sale-typed quotation back to the opportunity rather
 * than re-deriving it from the rough estimate.
 */
async function attachQuotation(opportunityId, saleId) {
  const opp = await Opportunity.findByIdAndUpdate(
    opportunityId,
    { $addToSet: { quotationIds: saleId }, lastActivityAt: new Date(), $set: { stage: 'proposal' } },
    { new: true }
  );
  if (!opp) throw new Error('Opportunity not found.');
  // Don't downgrade a stage that's already progressed past 'proposal' back
  // to 'proposal' just because a revised quote was attached — only bump
  // forward from an earlier stage.
  const idx = (s) => OPPORTUNITY_STAGES.indexOf(s);
  if (idx(opp.stage) < idx('proposal')) { opp.stage = 'proposal'; await opp.save(); }
  return opp;
}

async function markWon(opportunityId, saleId) {
  return updateStage(opportunityId, 'won', {}).then(async (opp) => {
    opp.wonSaleId = saleId;
    await opp.save();
    return opp;
  });
}

module.exports = { createOpportunity, listOpportunities, kanban, updateStage, attachQuotation, markWon };
