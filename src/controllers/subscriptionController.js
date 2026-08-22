const subscriptionService = require('../services/salesMarketing/subscriptionService');

async function createPlan(req, res) {
  try {
    res.status(201).json(await subscriptionService.createPlan({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listPlans(req, res) {
  res.json(await subscriptionService.listPlans(req.companyId));
}

async function subscribe(req, res) {
  try {
    res.status(201).json(await subscriptionService.subscribe(req.companyId, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const { customerId, status } = req.query;
  res.json(await subscriptionService.listSubscriptions(req.companyId, { customerId, status }));
}

async function pause(req, res) {
  try { res.json(await subscriptionService.pause(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function resume(req, res) {
  try { res.json(await subscriptionService.resume(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function cancel(req, res) {
  try { res.json(await subscriptionService.cancel(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function changePlan(req, res) {
  try { res.json(await subscriptionService.changePlan(req.params.id, req.body.newPlanId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { createPlan, listPlans, subscribe, list, pause, resume, cancel, changePlan };
