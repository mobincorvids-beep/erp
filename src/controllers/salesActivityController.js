const salesActivityService = require('../services/salesMarketing/salesActivityService');

async function create(req, res) {
  try {
    const activity = await salesActivityService.logActivity({ ...req.body, companyId: req.companyId, createdBy: req.auth.userId });
    res.status(201).json(activity);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listForEntity(req, res) {
  const activities = await salesActivityService.listForEntity(req.companyId, req.params.entityType, req.params.entityId);
  res.json(activities);
}

async function complete(req, res) {
  try {
    const activity = await salesActivityService.completeActivity(req.params.id, req.body.outcome);
    res.json(activity);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function dashboard(req, res) {
  const result = await salesActivityService.followUpDashboard(req.companyId, req.auth.userId);
  res.json(result);
}

module.exports = { create, listForEntity, complete, dashboard };
