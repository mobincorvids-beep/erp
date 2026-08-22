const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { LOYALTY_PROMOTIONS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/promotionController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list);
router.get('/applicable', controller.applicable); // ?productId=&categoryId=&branchId=&customerId=
router.post('/evaluate', controller.evaluate); // ?productId=... query for matching, body {quantity, unitPrice} for the effect
router.post('/', requirePermission(LOYALTY_PROMOTIONS_MANAGE),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('type').isIn(['buy_x_get_y', 'percentage_discount', 'fixed_discount']).withMessage('Invalid promotion type.'),
  validate, controller.create);

module.exports = router;
