const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PRICING_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/pricingController');

router.use(requireAuth, scopeToCompany);

// Read (resolving a real price for a checkout/quotation line) is left
// open — every sale/quotation flow needs this, not just pricing admins.
router.get('/resolve', controller.resolve); // ?productId=&variantId=&customerId=&quantity=

router.get('/product-prices', controller.listProductPrices); // ?productId=&priceGroupId=
router.post('/product-prices', requirePermission(PRICING_MANAGE),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('priceGroupId').isString().notEmpty().withMessage('priceGroupId is required.'),
  body('price').isFloat({ gt: 0 }).withMessage('price must be greater than zero.'),
  validate, controller.setProductPrice);

router.get('/rules', controller.listRules); // ?productId=&customerId=&type=
router.post('/rules', requirePermission(PRICING_MANAGE),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('type').isIn(['volume_tier', 'customer_price', 'percentage_discount']).withMessage('Invalid rule type.'),
  validate, controller.createRule);

module.exports = router;
