const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SALES_TARGETS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/salesTargetController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?salespersonId=&branchId=&territoryId=
router.get('/:id/achievement', controller.achievement);
router.post('/', requirePermission(SALES_TARGETS_MANAGE),
  body('label').isString().trim().notEmpty().withMessage('label is required.'),
  body('periodStart').isISO8601().withMessage('periodStart must be a valid date.'),
  body('periodEnd').isISO8601().withMessage('periodEnd must be a valid date.'),
  body('targetValue').isFloat({ gt: 0 }).withMessage('targetValue must be greater than zero.'),
  validate, controller.create);

module.exports = router;
