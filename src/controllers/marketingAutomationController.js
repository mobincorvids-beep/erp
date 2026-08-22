const automationService = require('../services/salesMarketing/automationService');
const customerSegmentationService = require('../services/salesMarketing/customerSegmentationService');

async function create(req, res) {
  try {
    res.status(201).json(await automationService.createAutomation({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  res.json(await automationService.listAutomations(req.companyId, { trigger: req.query.trigger }));
}

async function fireTrigger(req, res) {
  try {
    const { trigger, entityType, entityId } = req.body;
    res.status(201).json(await automationService.trigger(req.companyId, trigger, entityType, entityId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recomputeSegments(req, res) {
  res.json(await customerSegmentationService.recomputeAllSegments(req.companyId));
}

module.exports = { create, list, fireTrigger, recomputeSegments };
