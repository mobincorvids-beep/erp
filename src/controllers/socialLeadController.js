const socialLeadService = require('../services/salesMarketing/socialLeadService');

async function generateToken(req, res) {
  const token = await socialLeadService.generateWebhookToken(req.companyId);
  res.json({ token });
}

/** Public (webhook-token authed, not JWT) — req.companyId set by middleware/socialLeadAuth.js. */
async function capture(req, res) {
  try {
    const lead = await socialLeadService.captureLead(req.companyId, req.params.platform, req.body);
    res.status(201).json({ ok: true, leadId: lead._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { generateToken, capture };
