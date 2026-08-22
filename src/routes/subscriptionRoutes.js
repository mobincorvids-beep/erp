const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SUBSCRIPTIONS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/subscriptionController');

router.use(requireAuth, scopeToCompany);

router.get('/plans', controller.listPlans);
router.post('/plans', requirePermission(SUBSCRIPTIONS_MANAGE),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('billingCycle').isIn(['weekly', 'monthly', 'quarterly', 'annually']).withMessage('Invalid billingCycle.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  validate, controller.createPlan);

router.get('/', controller.list); // ?customerId=&status=
router.post('/',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('planId').isString().notEmpty().withMessage('planId is required.'),
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  validate, controller.subscribe);
router.post('/:id/pause', controller.pause);
router.post('/:id/resume', controller.resume);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/change-plan', body('newPlanId').isString().notEmpty().withMessage('newPlanId is required.'), validate, controller.changePlan);

module.exports = router;
