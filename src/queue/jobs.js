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
  logger.info('Scheduled repeating sweeps: document-expiry (daily), FBR-retry (every 15m).');
}

registerHandler('sweep.fanout.documentExpiry', () => enqueueForAllActiveCompanies('sweep.documentExpiry'));
registerHandler('sweep.fanout.fbrRetry', () => enqueueForAllActiveCompanies('sweep.fbrRetry'));

module.exports = { scheduleRepeatingJobs, enqueueForAllActiveCompanies };
