const fieldSalesService = require('../services/salesMarketing/fieldSalesService');

async function plan(req, res) {
  try {
    res.status(201).json(await fieldSalesService.planVisit({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const { salespersonId, customerId, status, from, to } = req.query;
  res.json(await fieldSalesService.listVisits(req.companyId, { salespersonId, customerId, status, from, to }));
}

async function checkIn(req, res) {
  try {
    res.json(await fieldSalesService.checkIn(req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function checkOut(req, res) {
  try {
    res.json(await fieldSalesService.checkOut(req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createOrder(req, res) {
  try {
    res.status(201).json(await fieldSalesService.createOrderDuringVisit(req.params.id, { ...req.body, userId: req.auth.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function collectPayment(req, res) {
  try {
    res.status(201).json(await fieldSalesService.collectPaymentDuringVisit(req.params.id, { ...req.body, userId: req.auth.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function productivity(req, res) {
  const { salespersonId, from, to } = req.query;
  res.json(await fieldSalesService.repProductivity(req.companyId, salespersonId, from, to));
}

module.exports = { plan, list, checkIn, checkOut, createOrder, collectPayment, productivity };
