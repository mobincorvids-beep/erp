const opportunityService = require('../services/salesMarketing/opportunityService');

async function create(req, res) {
  try {
    const opp = await opportunityService.createOpportunity({ ...req.body, companyId: req.companyId, createdBy: req.auth.userId });
    res.status(201).json(opp);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const { stage, salespersonId, territoryId, customerId, campaignId } = req.query;
  const opps = await opportunityService.listOpportunities(req.companyId, { stage, salespersonId, territoryId, customerId, campaignId });
  res.json(opps);
}

async function kanban(req, res) {
  const { salespersonId, territoryId } = req.query;
  const board = await opportunityService.kanban(req.companyId, { salespersonId, territoryId });
  res.json(board);
}

async function updateStage(req, res) {
  try {
    const opp = await opportunityService.updateStage(req.params.id, req.body.stage, {
      probability: req.body.probability, lostReason: req.body.lostReason, userId: req.auth.userId,
    });
    res.json(opp);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function attachQuotation(req, res) {
  try {
    const opp = await opportunityService.attachQuotation(req.params.id, req.body.saleId);
    res.json(opp);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, kanban, updateStage, attachQuotation };
