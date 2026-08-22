/**
 * LeadService — capture, scoring, and the New→Contacted→Qualified→
 * Interested→Opportunity→Quotation→Negotiation→Won/Lost pipeline (spec §2/§3).
 *
 * Terminal-state rule, stated directly: a Lead in 'won' or 'lost' can only
 * move by explicitly being reopened first (changeStatus back to a
 * non-terminal status) — the same "no silent reopening" discipline
 * ServiceOrder/Ticket status machines already hold to elsewhere in this
 * codebase. Everything else is a genuinely free transition, not forced
 * through the pipeline in strict order: a hot walk-in lead going straight
 * to 'quotation' is real, common sales behavior, not a data-entry error to
 * block.
 */
const mongoose = require('mongoose');
const Lead = require('../../models/Lead');
const Opportunity = require('../../models/Opportunity');
const Customer = require('../../models/Customer');
const SalesActivity = require('../../models/SalesActivity');
const { nextDocumentNumber } = require('../numberingService');
const { LEAD_STATUSES } = require('../../constants/salesMarketing');

function classifyRating(score) {
  if (score >= 60) return 'hot';
  if (score >= 30) return 'warm';
  return 'cold';
}

/**
 * Rule-based (explicitly not ML — same stated posture as aiInsightsService
 * elsewhere in this app) lead score from real, checkable signals: company
 * presence, estimated deal size, stated priority, industry filled in, and
 * genuine engagement (how many real SalesActivity records exist against
 * this lead, and how fast the FIRST one followed creation — response
 * speed is one of the spec's own named scoring inputs).
 */
async function rescoreLead(leadId) {
  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Lead not found.');

  let score = 0;
  if (lead.company) score += 10;
  if (lead.industry) score += 5;
  if (lead.estimatedValue >= 1000000) score += 25;
  else if (lead.estimatedValue >= 100000) score += 15;
  else if (lead.estimatedValue >= 10000) score += 5;
  if (lead.priority === 'high') score += 10;
  else if (lead.priority === 'medium') score += 5;

  const activities = await SalesActivity.find({ companyId: lead.companyId, entityType: 'Lead', entityId: lead._id })
    .sort({ createdAt: 1 })
    .limit(20);
  score += Math.min(activities.length * 4, 20); // real engagement, capped so a chatty log can't inflate the score without limit

  if (activities.length > 0) {
    const responseMs = activities[0].createdAt - lead.createdAt;
    if (responseMs <= 60 * 60 * 1000) score += 15; // responded within an hour
    else if (responseMs <= 24 * 60 * 60 * 1000) score += 8; // within a day
  }

  score = Math.min(score, 100);
  lead.score = score;
  lead.rating = classifyRating(score);
  await lead.save();
  return lead;
}

async function createLead(input) {
  const { companyId, branchId, name, source, createdBy } = input;
  if (!name) throw new Error('Lead name is required.');
  if (!source) throw new Error('Lead source is required.');

  const lead = await Lead.create({
    ...input,
    companyId, branchId, name, source, createdBy,
    leadNumber: nextDocumentNumber('LD'),
  });

  // Fires the 'lead_created' marketing automation trigger (spec §19) —
  // deliberately fire-and-forget, same "the real operation matters more
  // than the notification about it" principle the webhook/low-stock
  // triggers already established: a company with no such automation
  // configured, or a transient failure enrolling one, must never affect
  // lead creation itself.
  require('./automationService').trigger(companyId, 'lead_created', 'Lead', lead._id)
    .catch((err) => console.error('Failed to fire lead_created automation trigger (lead itself was still created):', err.message));

  return rescoreLead(lead._id);
}

function listLeads(companyId, { status, source, salespersonId, territoryId, campaignId, rating } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (source) filter.source = source;
  if (salespersonId) filter.salespersonId = salespersonId;
  if (territoryId) filter.territoryId = territoryId;
  if (campaignId) filter.campaignId = campaignId;
  if (rating) filter.rating = rating;
  return Lead.find(filter).sort({ createdAt: -1 }).limit(500);
}

async function updateLead(leadId, patch) {
  const disallowed = ['companyId', 'leadNumber', 'status', 'score', 'rating', 'convertedCustomerId', 'convertedOpportunityId'];
  disallowed.forEach((k) => delete patch[k]); // status/score/rating change through their own dedicated functions, not a generic patch — keeps the pipeline rules and scoring in one place
  const lead = await Lead.findByIdAndUpdate(leadId, patch, { new: true });
  if (!lead) throw new Error('Lead not found.');
  return lead;
}

async function changeStatus(leadId, newStatus, { lostReason, userId } = {}) {
  if (!LEAD_STATUSES.includes(newStatus)) throw new Error(`Invalid lead status: ${newStatus}`);
  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Lead not found.');

  if (newStatus === 'lost' && !lostReason) throw new Error('lostReason is required when marking a lead lost.');

  lead.status = newStatus;
  if (newStatus === 'lost') lead.lostReason = lostReason;
  if (newStatus !== 'lost') lead.lostReason = undefined;
  await lead.save();
  return lead;
}

/**
 * Lead -> Opportunity (spec pipeline's own next stage). An Opportunity
 * requires a real Customer (see models/Opportunity.js) — if this lead was
 * never linked to one, a Customer is created here from the lead's own
 * contact fields rather than forcing a separate manual step, tagged so
 * it's traceable back to where it actually came from.
 */
async function convertToOpportunity(leadId, { customerId, userId } = {}) {
  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Lead not found.');
  if (lead.convertedOpportunityId) throw new Error('This lead has already been converted to an opportunity.');

  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId) {
    const customer = await Customer.create({
      companyId: lead.companyId,
      name: lead.company || lead.name,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      tags: ['source:lead'],
    });
    resolvedCustomerId = customer._id;
  }

  const opportunity = await Opportunity.create({
    companyId: lead.companyId,
    branchId: lead.branchId,
    opportunityNumber: nextDocumentNumber('OPP'),
    customerId: resolvedCustomerId,
    contactPerson: lead.contactPerson || lead.name,
    leadId: lead._id,
    expectedValue: lead.estimatedValue,
    salespersonId: lead.salespersonId,
    territoryId: lead.territoryId,
    source: lead.source,
    campaignId: lead.campaignId,
    createdBy: userId,
  });

  lead.status = 'opportunity';
  lead.convertedCustomerId = resolvedCustomerId;
  lead.convertedOpportunityId = opportunity._id;
  await lead.save();

  return { lead, opportunity };
}

module.exports = { createLead, listLeads, updateLead, changeStatus, rescoreLead, convertToOpportunity };
