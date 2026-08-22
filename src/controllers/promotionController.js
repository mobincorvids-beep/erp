const promotionService = require('../services/salesMarketing/promotionService');

async function create(req, res) {
  try {
    res.status(201).json(await promotionService.createPromotion({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  res.json(await promotionService.listPromotions(req.companyId));
}

async function applicable(req, res) {
  const { productId, categoryId, branchId, customerId } = req.query;
  res.json(await promotionService.findApplicable(req.companyId, { productId, categoryId, branchId, customerId }));
}

async function evaluate(req, res) {
  try {
    const promotions = await promotionService.findApplicable(req.companyId, req.query);
    const { quantity, unitPrice } = req.body;
    const results = promotions.map((p) => ({ promotion: p, effect: promotionService.computeEffect(p, { quantity, unitPrice }) }));
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, applicable, evaluate };
