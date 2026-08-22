const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { LOYALTY_PROMOTIONS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/couponController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list);
router.post('/', requirePermission(LOYALTY_PROMOTIONS_MANAGE),
  body('code').isString().trim().notEmpty().withMessage('code is required.'),
  body('type').isIn(['percentage', 'fixed']).withMessage('type must be "percentage" or "fixed".'),
  body('value').isFloat({ gt: 0 }).withMessage('value must be greater than zero.'),
  validate, controller.create);
// Validating/redeeming a coupon is routine checkout work, left open — same
// posture as loyalty redemption and coupon-style discounts elsewhere.
router.post('/:code/validate', controller.validateCode);
router.post('/:code/redeem', controller.redeem);

module.exports = router;
