/**
 * Registers every job this app's worker process knows how to run, and the
 * periodic (repeatable) schedules that keep tenant-wide sweeps running
 * without a human clicking a button per company. Required once, at process
 * startup, by both `server.js` (so `enqueue()` has a handler to fall back
 * to inline when Redis isn't configured) and `worker.js` (so the worker
 * actually has something to process).
 *
 * Two real, previously-unwired gaps this closes — both explicitly flagged
 * as intended-but-not-built in this codebase's own README:
 *
 * - `documentService.checkExpiringDocuments(companyId)` existed and worked,
 *   but nothing ever called it except a user hitting its GET endpoint for
 *   their own company. A document silently expiring at a company whose
 *   staff never opened that page was never actually caught.
 * - `fbrService.findUnsubmittedSales(companyId)` existed "for a retry
 *   cron" per its own doc comment, but no cron existed — a sale whose FBR
 *   submission failed once (a network blip, FBR's API being briefly down)
 *   stayed unsubmitted forever unless someone manually retried it.
 *
 * Both are genuinely safe to run as scheduled sweeps: they're read-heavy,
 * idempotent (`checkExpiringDocuments` marks what it's already notified;
 * `submitInvoice` no-ops on a sale that already has `fbrSubmittedAt`), and
 * neither touches a hot transactional path — they run *after* the fact,
 * exactly the shape a background sweep should have.
 */
const { registerHandler, enqueue, getQueue } = require('./queue');
const { logger } = require('../lib/logger');

registerHandler('webhook.fire', async ({ companyId, eventType, payload }) => {
  const webhookService = require('../services/webhookService');
  return webhookService.fire(companyId, eventType, payload);
});

registerHandler('sweep.documentExpiry', async ({ companyId }) => {
  const documentService = require('../services/documentService');
  return documentService.checkExpiringDocuments(companyId);
});

registerHandler('sweep.salesFollowUpReminders', async ({ companyId }) => {
  const salesActivityService = require('../services/salesMarketing/salesActivityService');
  const notificationService = require('../services/notificationService');
  const due = await salesActivityService.findDueTodayOrOverdue(companyId);
  for (const activity of due) {
    if (!activity.assignedTo) continue; // an unassigned reminder has nobody real to notify — skip rather than guess a recipient
    await notificationService.notify({
      companyId, userId: activity.assignedTo, type: 'sales_follow_up_due',
      title: `Follow-up due: ${activity.subject}`,
      message: `${activity.type.replace('_', ' ')} for ${activity.entityType} was due ${activity.dueAt.toDateString()}.`,
      entityType: activity.entityType, entityId: activity.entityId,
    });
    await salesActivityService.markReminded(activity._id);
  }
  return { remindersSent: due.length };
});

registerHandler('sweep.marketingAutomationAdvance', async ({ companyId }) => {
  const automationService = require('../services/salesMarketing/automationService');
  const due = await automationService.findDueEnrollments(companyId);
  for (const enrollment of due) {
    // One enrollment failing (a deleted lead, a bad email) must never
    // block the rest of the batch — same discipline every other
    // per-company sweep here already holds to.
    await automationService.advanceEnrollment(enrollment._id).catch((err) =>
      logger.error({ err, enrollmentId: enrollment._id }, 'Failed to advance a marketing automation enrollment.'));
  }
  return { advanced: due.length };
});

registerHandler('sweep.invoiceOverdueTrigger', async ({ companyId }) => {
  const automationService = require('../services/salesMarketing/automationService');
  const Sale = require('../models/Sale');
  // Same "measured from createdAt" convention reportingService's own AR
  // aging already uses — Sale has no explicit due-date field (documented
  // there, not re-litigated here).
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const overdue = await Sale.find({
    companyId, dueAmount: { $gt: 0 }, writtenOff: false,
    createdAt: { $lte: cutoff }, overdueAutomationFiredAt: null, customerId: { $ne: null },
  });
  for (const sale of overdue) {
    await automationService.trigger(companyId, 'invoice_overdue', 'Customer', sale.customerId)
      .catch((err) => logger.error({ err, saleId: sale._id }, 'Failed to fire invoice_overdue trigger.'));
    sale.overdueAutomationFiredAt = new Date();
    await sale.save();
  }
  return { triggered: overdue.length };
});

registerHandler('sweep.customerSegmentation', async ({ companyId }) => {
  const customerSegmentationService = require('../services/salesMarketing/customerSegmentationService');
  return customerSegmentationService.recomputeAllSegments(companyId);
});

registerHandler('sweep.fbrRetry', async ({ companyId }) => {
  const fbrService = require('../services/fbrService');
  const Company = require('../models/Company');
  const company = await Company.findById(companyId);
  if (!company?.fbrPosId) return { skipped: 'not FBR-registered' };
  const unsubmitted = await fbrService.findUnsubmittedSales(companyId);
  const results = [];
  for (const sale of unsubmitted) {
    try {
      await fbrService.submitInvoice(sale._id);
      results.push({ saleId: sale._id, ok: true });
    } catch (err) {
      // One sale failing to submit (FBR down, a bad NTN) must never abort
      // the rest of the batch for the same company.
      results.push({ saleId: sale._id, ok: false, error: err.message });
    }
  }
  return { attempted: results.length, results };
});

/**
 * Fans a per-company sweep out across every active tenant. Enqueues one job
 * per company rather than looping companies inside a single job, so one
 * slow/misbehaving tenant's sweep can't delay or fail every other tenant's
 * — the same "one recipient failing doesn't abort the batch" principle
 * `webhookService.fire()` already applies at the subscription level,
 * applied here at the tenant level.
 */
async function enqueueForAllActiveCompanies(jobName) {
  const Company = require('../models/Company');
  const companies = await Company.find({ isActive: true }, '_id');
  await Promise.all(companies.map((c) => enqueue(jobName, { companyId: c._id })));
  return companies.length;
}

/** Registers BullMQ's repeatable jobs — the actual cron. No-ops without Redis (see queue.js); a single-instance/local deployment simply doesn't get proactive sweeps, same as before this file existed. */
async function scheduleRepeatingJobs() {
  const q = getQueue();
  if (!q) {
    logger.warn('No queue backend configured — skipping scheduled sweeps (document expiry, FBR retry). Set REDIS_URL to enable them.');
    return;
  }
  await q.add('sweep.fanout.documentExpiry', {}, { repeat: { pattern: '0 6 * * *' }, jobId: 'sweep-document-expiry-daily' }); // 06:00 UTC daily
  await q.add('sweep.fanout.fbrRetry', {}, { repeat: { pattern: '*/15 * * * *' }, jobId: 'sweep-fbr-retry-15min' }); // every 15 minutes — FBR outages are usually short
  await q.add('sweep.fanout.salesFollowUpReminders', {}, { repeat: { pattern: '*/30 * * * *' }, jobId: 'sweep-sales-followups-30min' }); // every 30 minutes — a follow-up reminder an hour late is still useful, no need for tighter polling
  await q.add('sweep.fanout.marketingAutomationAdvance', {}, { repeat: { pattern: '*/15 * * * *' }, jobId: 'sweep-marketing-automation-15min' }); // the actual clock this engine runs on — a step due "in 2 days" can be up to 15 minutes late, matching the spec's own day-granularity examples
  await q.add('sweep.fanout.invoiceOverdueTrigger', {}, { repeat: { pattern: '0 7 * * *' }, jobId: 'sweep-invoice-overdue-daily' }); // 07:00 UTC daily — a real day-granularity check, not a repeated same-day nag
  await q.add('sweep.fanout.customerSegmentation', {}, { repeat: { pattern: '0 5 * * *' }, jobId: 'sweep-customer-segmentation-daily' }); // 05:00 UTC daily — segment membership doesn't need to be more real-time than "as of this morning"
  logger.info('Scheduled repeating sweeps: document-expiry (daily), FBR-retry (every 15m), sales follow-up reminders (every 30m), marketing automation (every 15m), invoice-overdue trigger (daily), customer segmentation (daily).');
}

registerHandler('sweep.fanout.documentExpiry', () => enqueueForAllActiveCompanies('sweep.documentExpiry'));
registerHandler('sweep.fanout.fbrRetry', () => enqueueForAllActiveCompanies('sweep.fbrRetry'));
registerHandler('sweep.fanout.salesFollowUpReminders', () => enqueueForAllActiveCompanies('sweep.salesFollowUpReminders'));
registerHandler('sweep.fanout.marketingAutomationAdvance', () => enqueueForAllActiveCompanies('sweep.marketingAutomationAdvance'));
registerHandler('sweep.fanout.invoiceOverdueTrigger', () => enqueueForAllActiveCompanies('sweep.invoiceOverdueTrigger'));
registerHandler('sweep.fanout.customerSegmentation', () => enqueueForAllActiveCompanies('sweep.customerSegmentation'));

module.exports = { scheduleRepeatingJobs, enqueueForAllActiveCompanies };
