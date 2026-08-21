const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/opportunityController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?stage=&salespersonId=&territoryId=&customerId=&campaignId=
router.get('/kanban', controller.kanban); // ?salespersonId=&territoryId=
router.post('/',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  validate, controller.create);
router.post('/:id/stage', body('stage').isString().notEmpty().withMessage('stage is required.'), validate, controller.updateStage);
router.post('/:id/quotations', body('saleId').isString().notEmpty().withMessage('saleId is required.'), validate, controller.attachQuotation);

module.exports = router;
