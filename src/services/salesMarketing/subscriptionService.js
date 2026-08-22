/**
 * SubscriptionService — real trial/upgrade/downgrade/pause/cancel
 * lifecycle (spec §32) wrapped around recurringInvoiceService, which
 * already does the actual scheduled billing (see that file — reused
 * directly here, not reimplemented). Subscription is the thin layer that
 * knows about PLANS and TRIALS, concepts RecurringInvoiceTemplate itself
 * has no reason to know about.
 */
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const Subscription = require('../../models/Subscription');
const recurringInvoiceService = require('../recurringInvoiceService');

function createPlan(input) {
  const { items } = input;
  if (!items || items.length === 0) throw new Error('At least one item is required.');
  return SubscriptionPlan.create(input);
}

function listPlans(companyId) {
  return SubscriptionPlan.find({ companyId, isActive: true });
}

/** Real trial handling: trialDays > 0 means no billing template exists yet — nothing is charged during a trial, matching the spec's own "Trial" line item meaning something. */
async function subscribe(companyId, { customerId, planId, branchId }) {
  const plan = await SubscriptionPlan.findOne({ _id: planId, companyId, isActive: true });
  if (!plan) throw new Error('Subscription plan not found.');

  if (!branchId) throw new Error('branchId is required.');

  if (plan.trialDays > 0) {
    return Subscription.create({
      companyId, customerId, branchId, planId, status: 'trialing',
      trialEndsAt: new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000),
    });
  }

  const template = await recurringInvoiceService.createTemplate({
    companyId, branchId, customerId, items: plan.items, frequency: plan.billingCycle, startDate: new Date(),
  });
  return Subscription.create({ companyId, customerId, branchId, planId, status: 'active', recurringTemplateId: template._id });
}

/** Called by a sweep once a trial's real end date has passed — activates real billing from that point forward, never before. */
async function activateAfterTrial(subscriptionId) {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) throw new Error('Subscription not found.');
  if (sub.status !== 'trialing') return sub;

  const plan = await SubscriptionPlan.findById(sub.planId);
  const template = await recurringInvoiceService.createTemplate({
    companyId: sub.companyId, branchId: sub.branchId, customerId: sub.customerId, items: plan.items, frequency: plan.billingCycle, startDate: new Date(),
  });
  sub.status = 'active';
  sub.recurringTemplateId = template._id;
  await sub.save();
  return sub;
}

async function pause(subscriptionId) {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) throw new Error('Subscription not found.');
  if (sub.recurringTemplateId) await recurringInvoiceService.pauseTemplate(sub.recurringTemplateId);
  sub.status = 'paused';
  await sub.save();
  return sub;
}

async function resume(subscriptionId) {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) throw new Error('Subscription not found.');
  if (sub.recurringTemplateId) await recurringInvoiceService.resumeTemplate(sub.recurringTemplateId);
  sub.status = 'active';
  await sub.save();
  return sub;
}

async function cancel(subscriptionId) {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) throw new Error('Subscription not found.');
  if (sub.recurringTemplateId) await recurringInvoiceService.cancelTemplate(sub.recurringTemplateId);
  sub.status = 'cancelled';
  sub.cancelledAt = new Date();
  await sub.save();
  return sub;
}

/**
 * Upgrade/downgrade: cancels the current billing template and starts a
 * fresh one for the new plan, effective from now. Deliberately does NOT
 * attempt to prorate the switch mid-cycle — real proration needs a
 * genuine partial-period accounting decision this codebase doesn't have
 * an established pattern for yet, and a wrong guess at it is worse than
 * the honest, simpler "next charge is the new plan's amount" behavior.
 */
async function changePlan(subscriptionId, newPlanId) {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) throw new Error('Subscription not found.');
  const newPlan = await SubscriptionPlan.findOne({ _id: newPlanId, companyId: sub.companyId, isActive: true });
  if (!newPlan) throw new Error('New subscription plan not found.');

  if (sub.recurringTemplateId) await recurringInvoiceService.cancelTemplate(sub.recurringTemplateId);
  const template = await recurringInvoiceService.createTemplate({
    companyId: sub.companyId, branchId: sub.branchId, customerId: sub.customerId, items: newPlan.items, frequency: newPlan.billingCycle, startDate: new Date(),
  });

  sub.planId = newPlanId;
  sub.recurringTemplateId = template._id;
  sub.status = 'active';
  await sub.save();
  return sub;
}

function listSubscriptions(companyId, { customerId, status } = {}) {
  const filter = { companyId };
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;
  return Subscription.find(filter).populate('planId', 'name billingCycle');
}

/** Used by a queue sweep — every trial whose real end date has arrived. */
function findEndedTrials(companyId) {
  return Subscription.find({ companyId, status: 'trialing', trialEndsAt: { $lte: new Date() } });
}

module.exports = { createPlan, listPlans, subscribe, activateAfterTrial, pause, resume, cancel, changePlan, listSubscriptions, findEndedTrials };
