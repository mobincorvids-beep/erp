const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { MARKETING_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/landingPageController');

router.use(requireAuth, scopeToCompany, requirePermission(MARKETING_MANAGE));

router.get('/', controller.list);
router.post('/',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('slug').isString().trim().notEmpty().withMessage('slug is required.'),
  validate, controller.create);

module.exports = router;
