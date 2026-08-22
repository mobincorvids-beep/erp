const Customer = require('../models/Customer');
const customerLedgerService = require('../services/customerLedgerService');
const customer360Service = require('../services/salesMarketing/customer360Service');

async function list(req, res) {
  const customers = await Customer.find({ companyId: req.companyId }).limit(200);
  res.json(customers);
}

async function create(req, res) {
  const customer = await Customer.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(customer);
}

async function getLedger(req, res) {
  try {
    const ledger = await customerLedgerService.ledger(req.params.id);
    res.json(ledger);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recordPayment(req, res) {
  try {
    const payment = await customerLedgerService.recordPayment({
      ...req.body, customerId: req.params.id, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function aging(req, res) {
  const rows = await customerLedgerService.agingReport(req.companyId);
  res.json(rows);
}

/** Territory -> Salesperson -> Customer assignment (spec §14) — a narrow, dedicated endpoint rather than a generic PATCH, so this route can never be used to silently change unrelated fields like creditLimit or openingBalance. */
async function assignTerritory(req, res) {
  const { territoryId, assignedSalespersonId } = req.body;
  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { territoryId: territoryId || null, assignedSalespersonId: assignedSalespersonId || null },
    { new: true }
  );
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });
  res.json(customer);
}

async function view360(req, res) {
  try {
    res.json(await customer360Service.view(req.companyId, req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, create, getLedger, recordPayment, aging, assignTerritory, view360 };
