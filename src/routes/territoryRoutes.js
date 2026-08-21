const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { TERRITORIES_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/territoryController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?level=&parentId=
router.get('/tree', controller.tree);
router.post('/', requirePermission(TERRITORIES_MANAGE),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('level').isString().notEmpty().withMessage('level is required.'),
  validate, controller.create);
router.patch('/:id', requirePermission(TERRITORIES_MANAGE), controller.update);

module.exports = router;
