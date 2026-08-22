const salesTargetService = require('../services/salesMarketing/salesTargetService');

async function create(req, res) {
  try {
    res.status(201).json(await salesTargetService.setTarget({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const { salespersonId, branchId, territoryId } = req.query;
  res.json(await salesTargetService.listTargets(req.companyId, { salespersonId, branchId, territoryId }));
}

async function achievement(req, res) {
  try {
    res.json(await salesTargetService.achievement(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, achievement };
