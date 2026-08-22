const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { REPORTS_VIEW } = require('../constants/permissions');
const controller = require('../controllers/forecastController');

router.use(requireAuth, scopeToCompany, requirePermission(REPORTS_VIEW));

router.get('/pipeline', controller.pipeline); // ?salespersonId=&territoryId=
router.get('/historical', controller.historical); // ?monthsBack=

module.exports = router;
