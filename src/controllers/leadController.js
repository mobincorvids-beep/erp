const leadService = require('../services/salesMarketing/leadService');

async function create(req, res) {
  try {
    const lead = await leadService.createLead({ ...req.body, companyId: req.companyId, createdBy: req.auth.userId });
    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const { status, source, salespersonId, territoryId, campaignId, rating } = req.query;
  const leads = await leadService.listLeads(req.companyId, { status, source, salespersonId, territoryId, campaignId, rating });
  res.json(leads);
}

async function update(req, res) {
  try {
    const lead = await leadService.updateLead(req.params.id, req.body);
    res.json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function changeStatus(req, res) {
  try {
    const lead = await leadService.changeStatus(req.params.id, req.body.status, {
      lostReason: req.body.lostReason, userId: req.auth.userId,
    });
    res.json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function convertToOpportunity(req, res) {
  try {
    const result = await leadService.convertToOpportunity(req.params.id, {
      customerId: req.body.customerId, userId: req.auth.userId,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, update, changeStatus, convertToOpportunity };
