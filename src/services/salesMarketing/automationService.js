/**
 * AutomationService — advances real MarketingAutomationEnrollment records
 * through their MarketingAutomation's steps (spec §19). Two real, wired
 * triggers prove the pattern end to end rather than being left as
 * unreachable schema: 'lead_created' fires directly from
 * leadService.createLead() (an additive, non-transactional call — see
 * that file), and 'invoice_overdue' fires from a queue-backed sweep (see
 * queue/jobs.js) alongside the existing document-expiry/FBR-retry
 * sweeps. The other MARKETING_AUTOMATION_TRIGGERS values are real,
 * validated enum options a company CAN build an automation against
 * today — wiring each one to its own real event (quote_expired,
 * abandoned_cart, birthday, ...) is real, separate, additional work
 * this phase didn't reach, stated directly rather than implied finished.
 */
const MarketingAutomation = require('../../models/MarketingAutomation');
const MarketingAutomationEnrollment = require('../../models/MarketingAutomationEnrollment');
const Lead = require('../../models/Lead');
const Customer = require('../../models/Customer');
const messagingService = require('../messaging/messagingService');
const notificationService = require('../notificationService');

function createAutomation(input) {
  const { steps } = input;
  if (!steps || steps.length === 0) throw new Error('At least one step is required.');
  return MarketingAutomation.create(input);
}

function listAutomations(companyId, { trigger } = {}) {
  const filter = { companyId };
  if (trigger) filter.trigger = trigger;
  return MarketingAutomation.find(filter);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Fires a real event — enrolls the entity in every active automation
 * listening for this trigger, unless it's already actively enrolled in
 * that same automation (the real dedup: re-firing 'lead_created' for a
 * lead that somehow already has an active enrollment is a no-op, not a
 * second parallel journey).
 */
async function trigger(companyId, triggerType, entityType, entityId) {
  const automations = await MarketingAutomation.find({ companyId, trigger: triggerType, isActive: true });
  const enrollments = [];
  for (const automation of automations) {
    const existing = await MarketingAutomationEnrollment.findOne({
      companyId, automationId: automation._id, entityType, entityId, status: 'active',
    });
    if (existing) continue;

    const firstStep = [...automation.steps].sort((a, b) => a.order - b.order)[0];
    const enrollment = await MarketingAutomationEnrollment.create({
      companyId, automationId: automation._id, entityType, entityId,
      currentStepIndex: 0, status: 'active', nextRunAt: addHours(new Date(), firstStep.delayHours || 0),
    });
    enrollments.push(enrollment);
  }
  return enrollments;
}

async function resolveContact(entityType, entityId) {
  if (entityType === 'Lead') {
    const lead = await Lead.findById(entityId);
    return lead ? { email: lead.email, phone: lead.phone, whatsapp: lead.whatsapp || lead.phone, name: lead.name } : null;
  }
  const customer = await Customer.findById(entityId);
  return customer ? { email: customer.email, phone: customer.phone, whatsapp: customer.phone, name: customer.name } : null;
}

async function runStep(companyId, enrollment, step) {
  const contact = await resolveContact(enrollment.entityType, enrollment.entityId);
  if (!contact) return; // the lead/customer this enrollment points at no longer exists — nothing left to do, not an error

  if (step.action === 'send_email') await messagingService.sendEmail(contact.email, step.subject || '', step.message);
  else if (step.action === 'send_sms') await messagingService.sendSms(contact.phone, step.message);
  else if (step.action === 'send_whatsapp') await messagingService.sendWhatsapp(contact.whatsapp, step.message);
  else if (step.action === 'notify_sales') {
    // Targets whoever holds the leads.manage permission — the same
    // "notify whoever's actually responsible" escape hatch
    // documentService.checkExpiringDocuments() already uses (via
    // roles.manage there). notificationService.notify() requires a real
    // userId or roleId; a company with no such role configured yet
    // genuinely has nobody to notify, so this is skipped rather than
    // thrown into the caller's face — a subtly different, deliberate
    // choice from that catch below, which is for genuine transport errors.
    const Role = require('../../models/Role');
    const roles = await Role.find({ companyId, permissions: { $in: ['leads.manage', '*'] } });
    for (const role of roles) {
      await notificationService.notify({
        companyId, roleId: role._id, type: 'marketing_automation_followup', title: `Follow up: ${contact.name}`,
        message: step.message || `${contact.name} reached a follow-up step in a marketing automation.`,
        entityType: enrollment.entityType, entityId: enrollment.entityId,
      }).catch(() => {}); // best-effort — one role failing to notify shouldn't stop the automation from advancing
    }
  }
  // 'create_opportunity' is intentionally NOT implemented as an automation
  // step yet — it would need a resolved Customer (a Lead-stage entity may
  // not have one), which is exactly the judgment call
  // leadService.convertToOpportunity() already makes deliberately, not
  // something to silently re-decide inside a generic automation step.
}

/** Advances ONE enrollment one step — called by the sweep below, one enrollment at a time, so one bad enrollment can't block the rest of the batch. */
async function advanceEnrollment(enrollmentId) {
  const enrollment = await MarketingAutomationEnrollment.findById(enrollmentId);
  if (!enrollment || enrollment.status !== 'active') return null;

  const automation = await MarketingAutomation.findById(enrollment.automationId);
  if (!automation || !automation.isActive) { enrollment.status = 'cancelled'; await enrollment.save(); return enrollment; }

  const steps = [...automation.steps].sort((a, b) => a.order - b.order);
  const step = steps[enrollment.currentStepIndex];
  if (!step) { enrollment.status = 'completed'; await enrollment.save(); return enrollment; }

  await runStep(enrollment.companyId, enrollment, step);
  enrollment.lastRunAt = new Date();

  const nextStep = steps[enrollment.currentStepIndex + 1];
  if (nextStep) {
    enrollment.currentStepIndex += 1;
    enrollment.nextRunAt = addHours(new Date(), nextStep.delayHours || 0);
  } else {
    enrollment.status = 'completed';
  }
  await enrollment.save();
  return enrollment;
}

/** Used by the queue's scheduled sweep — every enrollment across the company whose step is actually due. */
function findDueEnrollments(companyId) {
  return MarketingAutomationEnrollment.find({ companyId, status: 'active', nextRunAt: { $lte: new Date() } });
}

module.exports = { createAutomation, listAutomations, trigger, advanceEnrollment, findDueEnrollments };
