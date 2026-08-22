const commissionService = require('../services/salesMarketing/commissionService');

async function createPlan(req, res) {
  try {
    res.status(201).json(await commissionService.createPlan({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listPlans(req, res) {
  res.json(await commissionService.listPlans(req.companyId, { salespersonId: req.query.salespersonId }));
}

async function calculate(req, res) {
  try {
    const { salespersonId, periodStart, periodEnd } = req.query;
    res.json(await commissionService.calculateCommission(req.companyId, salespersonId, new Date(periodStart), new Date(periodEnd)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function postToPayroll(req, res) {
  try {
    const { payrollRunId, salespersonId, periodStart, periodEnd } = req.body;
    res.status(201).json(await commissionService.postToPayroll(req.companyId, payrollRunId, salespersonId, new Date(periodStart), new Date(periodEnd)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createPlan, listPlans, calculate, postToPayroll };
