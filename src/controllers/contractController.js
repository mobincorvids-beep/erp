const contractService = require('../services/salesMarketing/contractService');

async function create(req, res) {
  try {
    res.status(201).json(await contractService.createContract({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const { customerId, status } = req.query;
  res.json(await contractService.listContracts(req.companyId, { customerId, status }));
}

async function submitForApproval(req, res) {
  try {
    res.status(201).json(await contractService.submitForApproval(req.params.id, req.auth.userId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function activate(req, res) {
  try { res.json(await contractService.activate(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function amend(req, res) {
  try { res.json(await contractService.amend(req.params.id, req.body.note, req.auth.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function terminate(req, res) {
  try { res.json(await contractService.terminate(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { create, list, submitForApproval, activate, amend, terminate };
