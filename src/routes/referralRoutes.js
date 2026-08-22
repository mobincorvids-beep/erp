const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/referralController');

router.use(requireAuth, scopeToCompany);

router.post('/customers/:customerId/code', controller.getOrCreateCode);
router.get('/customers/:customerId/dashboard', controller.dashboard);
router.post('/:code/redeem', body('referredCustomerId').isString().notEmpty().withMessage('referredCustomerId is required.'), validate, controller.redeemCode);

module.exports = router;
