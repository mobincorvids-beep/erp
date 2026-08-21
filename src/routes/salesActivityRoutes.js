const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/salesActivityController');

router.use(requireAuth, scopeToCompany);

router.get('/dashboard', controller.dashboard); // spec §6's Today's/Overdue/Upcoming follow-ups, Hot leads/opportunities
router.get('/for/:entityType/:entityId', controller.listForEntity);
router.post('/',
  body('type').isString().notEmpty().withMessage('type is required.'),
  body('entityType').isString().notEmpty().withMessage('entityType is required.'),
  body('entityId').isString().notEmpty().withMessage('entityId is required.'),
  body('subject').isString().trim().notEmpty().withMessage('subject is required.'),
  validate, controller.create);
router.post('/:id/complete', controller.complete);

module.exports = router;
