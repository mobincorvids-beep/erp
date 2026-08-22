/**
 * LandingPageService — real lead-form backends (spec §24). Every
 * submission becomes a real Lead with genuine source/campaign
 * attribution, reusing leadService.createLead() directly rather than a
 * second Lead-creation path — a lead from a form and a lead entered by
 * hand are the same kind of record, scored and pipelined identically.
 */
const LandingPage = require('../../models/LandingPage');
const leadService = require('./leadService');

function createForm(input) {
  const { companyId, name, slug } = input;
  if (!name || !slug) throw new Error('name and slug are required.');
  return LandingPage.create(input);
}

function listForms(companyId) {
  return LandingPage.find({ companyId });
}

/** The public, unauthenticated half — anyone who has the form's slug (embedded on whatever real page hosts it) can submit. */
async function submit(companyId, slug, submission) {
  const form = await LandingPage.findOne({ companyId, slug, isActive: true });
  if (!form) throw new Error('This form is not available.');

  const { name, phone, email, message } = submission;
  if (!name) throw new Error('name is required.');

  const lead = await leadService.createLead({
    companyId, name, phone, email, notes: message,
    source: 'landing_page', campaignId: form.campaignId || undefined,
    productInterest: form.formType === 'product_enquiry' ? message : undefined,
  });

  form.submissionCount += 1;
  await form.save();

  return lead;
}

module.exports = { createForm, listForms, submit };
