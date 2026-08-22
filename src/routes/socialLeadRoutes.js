const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { requireSocialLeadToken } = require('../middleware/socialLeadAuth');
const { MARKETING_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/socialLeadController');

// Tenant-side: generate/rotate the webhook token to hand to whatever
// bridges a real social platform's webhook to this endpoint.
router.post('/token', requireAuth, scopeToCompany, requirePermission(MARKETING_MANAGE), controller.generateToken);

// The actual inbound webhook — company resolved by slug + token, not a
// tenant session (see middleware/socialLeadAuth.js), same shape as the
// e-commerce webhook.
router.post('/:slug/:platform', requireSocialLeadToken, controller.capture);

module.exports = router;
