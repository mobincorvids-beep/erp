const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { MARKETING_MANAGE } = require('../constants/permissions');
const { MARKETING_AUTOMATION_TRIGGERS } = require('../constants/salesMarketing');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/marketingAutomationController');

router.use(requireAuth, scopeToCompany, requirePermission(MARKETING_MANAGE));

router.get('/', controller.list); // ?trigger=
router.post('/',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('trigger').isIn(MARKETING_AUTOMATION_TRIGGERS).withMessage('Invalid trigger.'),
  body('steps').isArray({ min: 1 }).withMessage('At least one step is required.'),
  validate, controller.create);
// Manual firing — for triggers this phase didn't wire to a real event yet
// (quote_expired, abandoned_cart, birthday, ...), a caller (a future
// integration, or a person) can still fire them deliberately.
router.post('/trigger',
  body('trigger').isIn(MARKETING_AUTOMATION_TRIGGERS).withMessage('Invalid trigger.'),
  body('entityType').isIn(['Lead', 'Customer']).withMessage('entityType must be "Lead" or "Customer".'),
  body('entityId').isString().notEmpty().withMessage('entityId is required.'),
  validate, controller.fireTrigger);
router.post('/recompute-segments', controller.recomputeSegments);

module.exports = router;
