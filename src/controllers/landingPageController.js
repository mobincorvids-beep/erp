const landingPageService = require('../services/salesMarketing/landingPageService');

async function create(req, res) {
  try {
    res.status(201).json(await landingPageService.createForm({ ...req.body, companyId: req.companyId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  res.json(await landingPageService.listForms(req.companyId));
}

/** Public — no requireAuth, see routes file. Company resolved by slug in the URL, matching the e-commerce webhook's own pattern for "an external caller with no tenant session." */
async function submit(req, res) {
  try {
    const Company = require('../models/Company');
    const company = await Company.findOne({ slug: req.params.companySlug, isActive: true });
    if (!company) return res.status(404).json({ error: 'Not found.' });
    const lead = await landingPageService.submit(company._id, req.params.formSlug, req.body);
    res.status(201).json({ ok: true, leadId: lead._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, submit };
