const Company = require('../models/Company');

/**
 * Auth for the inbound social-lead webhook (spec §23) — the same shape as
 * ecommerceAuth.js's requireWebhookToken (a real webhook integration
 * source, not a tenant user, so no JWT), deliberately checked against
 * Company.socialLeadWebhookToken rather than ecommerceConfig.webhookToken
 * — see that field's own comment for why these stay separate secrets.
 */
async function requireSocialLeadToken(req, res, next) {
  const { slug } = req.params;
  const token = req.headers['x-webhook-token'];
  if (!token) return res.status(401).json({ error: 'Missing X-Webhook-Token header.' });

  const company = await Company.findOne({ slug });
  if (!company) return res.status(404).json({ error: 'Company not found.' });
  if (!company.isActive) return res.status(403).json({ error: 'This company is not currently active.' });
  if (!company.socialLeadWebhookToken || company.socialLeadWebhookToken !== token) {
    return res.status(401).json({ error: 'Invalid webhook token.' });
  }

  req.company = company;
  req.companyId = company._id;
  next();
}

module.exports = { requireSocialLeadToken };
