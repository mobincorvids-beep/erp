const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/b2bController');

router.use(requireAuth, scopeToCompany);

router.get('/tenders', controller.listTenders); // ?status=&customerId=
router.post('/tenders',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('title').isString().trim().notEmpty().withMessage('title is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  validate, controller.createTender);
router.get('/tenders/:tenderId/bids', controller.listBids);
router.post('/tenders/:tenderId/bids',
  body('quotationId').isString().notEmpty().withMessage('quotationId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  validate, controller.submitBid);
router.post('/tenders/:tenderId/award', body('bidId').isString().notEmpty().withMessage('bidId is required.'), validate, controller.awardBid);

module.exports = router;
