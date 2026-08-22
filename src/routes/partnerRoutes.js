const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PARTNERS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/partnerController');

router.use(requireAuth, scopeToCompany, requirePermission(PARTNERS_MANAGE));

router.get('/', controller.list); // ?type=&territoryId=
router.post('/',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('type').isIn(['dealer', 'distributor', 'agent', 'reseller', 'franchise']).withMessage('Invalid partner type.'),
  validate, controller.create);
router.patch('/:id', controller.update);
router.get('/:id/commission', controller.commission); // ?periodStart=&periodEnd=
router.post('/:id/rebates',
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('rebateExpenseAccountId').isString().notEmpty().withMessage('rebateExpenseAccountId is required.'),
  validate, controller.rebate);
router.get('/:id/statement', controller.statement);

module.exports = router;
