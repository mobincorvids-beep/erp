const partnerService = require('../services/salesMarketing/partnerService');

async function create(req, res) {
  try {
    res.status(201).json(await partnerService.createPartner({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const { type, territoryId } = req.query;
  res.json(await partnerService.listPartners(req.companyId, { type, territoryId }));
}

async function update(req, res) {
  try {
    res.json(await partnerService.updatePartner(req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function commission(req, res) {
  try {
    const { periodStart, periodEnd } = req.query;
    res.json(await partnerService.calculateCommission(req.companyId, req.params.id, new Date(periodStart), new Date(periodEnd)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function rebate(req, res) {
  try {
    res.status(201).json(await partnerService.recordRebate(req.companyId, req.params.id, { ...req.body, userId: req.auth.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function statement(req, res) {
  try {
    res.json(await partnerService.statement(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, update, commission, rebate, statement };
