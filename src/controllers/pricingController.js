const pricingEngineService = require('../services/salesMarketing/pricingEngineService');

async function resolve(req, res) {
  try {
    const { productId, variantId, customerId, quantity } = req.query;
    const result = await pricingEngineService.resolvePrice({
      companyId: req.companyId, productId, variantId, customerId,
      quantity: quantity ? Number(quantity) : 1,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function setProductPrice(req, res) {
  try {
    const price = await pricingEngineService.setProductPrice({ ...req.body, companyId: req.companyId });
    res.status(201).json(price);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listProductPrices(req, res) {
  const { productId, priceGroupId } = req.query;
  res.json(await pricingEngineService.listProductPrices(req.companyId, { productId, priceGroupId }));
}

async function createRule(req, res) {
  try {
    const rule = await pricingEngineService.createRule({ ...req.body, companyId: req.companyId });
    res.status(201).json(rule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listRules(req, res) {
  const { productId, customerId, type } = req.query;
  res.json(await pricingEngineService.listRules(req.companyId, { productId, customerId, type }));
}

module.exports = { resolve, setProductPrice, listProductPrices, createRule, listRules };
