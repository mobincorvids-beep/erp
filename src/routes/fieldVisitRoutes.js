const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/fieldVisitController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?salespersonId=&customerId=&status=&from=&to=
router.get('/productivity', controller.productivity); // ?salespersonId=&from=&to=
router.post('/',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('salespersonId').isString().notEmpty().withMessage('salespersonId is required.'),
  validate, controller.plan);
router.post('/:id/check-in', controller.checkIn);
router.post('/:id/check-out', controller.checkOut);
router.post('/:id/orders', controller.createOrder);
router.post('/:id/payments', body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'), validate, controller.collectPayment);

module.exports = router;
