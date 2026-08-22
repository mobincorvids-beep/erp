const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/landingPageController');

// No requireAuth/scopeToCompany — this is the actual public form
// submission endpoint (spec §24), meant to be POSTed to from whatever
// real page embeds the form. Still behind the global generalLimiter
// (see server.js), the same rate-limit boundary every other public-
// facing route in this app already has.
router.post('/:companySlug/:formSlug',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  validate, controller.submit);

module.exports = router;
