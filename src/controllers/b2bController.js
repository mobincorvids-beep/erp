const b2bService = require('../services/salesMarketing/b2bService');

async function createTender(req, res) {
  try {
    res.status(201).json(await b2bService.createTender({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listTenders(req, res) {
  const { status, customerId } = req.query;
  res.json(await b2bService.listTenders(req.companyId, { status, customerId }));
}

async function submitBid(req, res) {
  try {
    res.status(201).json(await b2bService.submitBid({ ...req.body, tenderId: req.params.tenderId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listBids(req, res) {
  res.json(await b2bService.listBids(req.params.tenderId));
}

async function awardBid(req, res) {
  try {
    res.json(await b2bService.awardBid(req.params.tenderId, req.body.bidId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createTender, listTenders, submitBid, listBids, awardBid };
