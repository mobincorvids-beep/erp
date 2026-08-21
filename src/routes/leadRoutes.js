const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/leadController');

router.use(requireAuth, scopeToCompany);

// Left open (no permission gate), same call this codebase already made for
// CRM feedback/follow-ups — capturing/working a lead is routine front-line
// sales work, not a sensitive operation to lock down.
router.get('/', controller.list); // ?status=&source=&salespersonId=&territoryId=&campaignId=&rating=
router.post('/',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('source').isString().trim().notEmpty().withMessage('source is required.'),
  validate, controller.create);
router.patch('/:id', controller.update);
router.post('/:id/status', body('status').isString().notEmpty().withMessage('status is required.'), validate, controller.changeStatus);
router.post('/:id/convert-to-opportunity', controller.convertToOpportunity);

module.exports = router;
