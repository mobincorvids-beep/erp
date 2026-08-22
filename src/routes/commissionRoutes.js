const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { COMMISSIONS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/commissionController');

router.use(requireAuth, scopeToCompany, requirePermission(COMMISSIONS_MANAGE));

router.get('/plans', controller.listPlans); // ?salespersonId=
router.post('/plans',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('rateType').isIn(['flat', 'tiered']).withMessage('rateType must be "flat" or "tiered".'),
  validate, controller.createPlan);
router.get('/calculate', controller.calculate); // ?salespersonId=&periodStart=&periodEnd=
router.post('/post-to-payroll',
  body('payrollRunId').isString().notEmpty().withMessage('payrollRunId is required.'),
  body('salespersonId').isString().notEmpty().withMessage('salespersonId is required.'),
  body('periodStart').isISO8601().withMessage('periodStart must be a valid date.'),
  body('periodEnd').isISO8601().withMessage('periodEnd must be a valid date.'),
  validate, controller.postToPayroll);

module.exports = router;
