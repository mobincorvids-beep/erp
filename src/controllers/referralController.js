const referralService = require('../services/salesMarketing/referralService');

async function getOrCreateCode(req, res) {
  try {
    res.json(await referralService.getOrCreateCode(req.companyId, req.params.customerId, req.body.rewardPoints));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function redeemCode(req, res) {
  try {
    res.status(201).json(await referralService.redeemCode(req.companyId, req.params.code, req.body.referredCustomerId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function dashboard(req, res) {
  res.json(await referralService.dashboard(req.companyId, req.params.customerId));
}

module.exports = { getOrCreateCode, redeemCode, dashboard };
