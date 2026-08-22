const couponService = require('../services/salesMarketing/couponService');

async function create(req, res) {
  try {
    res.status(201).json(await couponService.createCoupon({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  res.json(await couponService.listCoupons(req.companyId));
}

async function validateCode(req, res) {
  const { customerId, purchaseAmount, productIds } = req.body;
  res.json(await couponService.validateCoupon(req.companyId, req.params.code, { customerId, purchaseAmount: Number(purchaseAmount) || 0, productIds }));
}

async function redeem(req, res) {
  try {
    const { customerId, saleId, purchaseAmount, productIds } = req.body;
    res.status(201).json(await couponService.redeemCoupon(req.companyId, req.params.code, { customerId, saleId, purchaseAmount: Number(purchaseAmount) || 0, productIds }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, validateCode, redeem };
