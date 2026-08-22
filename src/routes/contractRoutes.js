const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { CONTRACTS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/contractController');

router.use(requireAuth, scopeToCompany, requirePermission(CONTRACTS_MANAGE));

router.get('/', controller.list); // ?customerId=&status=
router.post('/',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('lines').isArray({ min: 1 }).withMessage('At least one line is required.'),
  body('periodStart').isISO8601().withMessage('periodStart must be a valid date.'),
  body('periodEnd').isISO8601().withMessage('periodEnd must be a valid date.'),
  validate, controller.create);
router.post('/:id/submit-for-approval', controller.submitForApproval);
router.post('/:id/activate', controller.activate);
router.post('/:id/amend', body('note').isString().trim().notEmpty().withMessage('note is required.'), validate, controller.amend);
router.post('/:id/terminate', controller.terminate);

module.exports = router;
