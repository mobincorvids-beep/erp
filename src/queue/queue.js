/**
 * A minimal durable job queue for the async side effects this app already
 * has (webhook delivery is the first real consumer — see
 * `services/webhookService.js` and the `WEBHOOK_ASYNC` flag in
 * `posSaleService.checkout()`). Two real problems this closes:
 *
 * 1. **Checkout was blocking on outbound HTTP.** `posSaleService.checkout()`
 *    `await`s `webhookService.fire()`, which sequentially POSTs to every
 *    subscriber's URL with no timeout. One slow or dead subscriber stalls
 *    every cashier's checkout at that company — the single worst place in
 *    this app for that to happen. Queueing the job means checkout enqueues
 *    (a fast, local Redis write) and returns; delivery happens out-of-band
 *    in a separate worker process.
 * 2. **Fire-and-forget work was lost on crash.** An in-process
 *    `setImmediate`/un-awaited call disappears if the process restarts
 *    before it runs — fine for a single dev instance, not fine once this
 *    is deployed as N replicas behind a load balancer with routine
 *    rolling restarts. A BullMQ job survives in Redis until a worker
 *    actually completes it, with retry/backoff for transient failures
 *    (a subscriber's endpoint being briefly down, a network blip).
 *
 * Same optional-Redis posture as `config/redis.js`: with no `REDIS_URL`,
 * `enqueue()` runs the job inline via `setImmediate` — durable delivery
 * needs Redis, but nothing *requires* Redis to keep working, including
 * this file's own require() at startup.
 */
const { getRedis } = require('../config/redis');
const { logger } = require('../lib/logger');

const BullMQ = (() => {
  try {
    return require('bullmq');
  } catch (e) {
    return null;
  }
})();

const QUEUE_NAME = 'erp-jobs';
const handlers = new Map();
let queue = null;

function registerHandler(jobName, fn) {
  handlers.set(jobName, fn);
}

function getQueue() {
  const redis = getRedis();
  if (!redis || !BullMQ) return null;
  if (!queue) {
    queue = new BullMQ.Queue(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600 }, // keep an hour of history for debugging, don't grow Redis unbounded
        removeOnFail: { age: 86400 }, // keep failures a day longer — that's the evidence you need to diagnose a dead subscriber
      },
    });
  }
  return queue;
}

/**
 * Enqueue a job. Never throws back into the caller's request path on a
 * Redis error — a queueing failure should degrade to "run it inline
 * anyway", not take down the checkout/whatever-called-this that's
 * otherwise already succeeded.
 */
async function enqueue(jobName, payload) {
  const q = getQueue();
  if (!q) {
    setImmediate(() => runInline(jobName, payload));
    return { queued: false, mode: 'inline' };
  }
  try {
    await q.add(jobName, payload);
    return { queued: true, mode: 'redis' };
  } catch (err) {
    logger.error({ err, jobName }, 'Failed to enqueue job — falling back to inline execution.');
    setImmediate(() => runInline(jobName, payload));
    return { queued: false, mode: 'inline-fallback' };
  }
}

async function runInline(jobName, payload) {
  const handler = handlers.get(jobName);
  if (!handler) {
    logger.error({ jobName }, 'No handler registered for job — dropped.');
    return;
  }
  try {
    await handler(payload);
  } catch (err) {
    logger.error({ err, jobName }, 'Inline job execution failed (no retry available without Redis).');
  }
}

/** Started only by the separate worker process (`src/worker.js`) — the API process enqueues, it never processes, so job execution scales independently of request traffic. */
function startWorker() {
  const redis = getRedis();
  if (!redis || !BullMQ) {
    logger.warn('startWorker() called without Redis/BullMQ available — nothing to do; jobs run inline in whichever process enqueues them.');
    return null;
  }
  const worker = new BullMQ.Worker(
    QUEUE_NAME,
    async (job) => {
      const handler = handlers.get(job.name);
      if (!handler) throw new Error(`No handler registered for job "${job.name}".`);
      return handler(job.data);
    },
    { connection: redis, concurrency: Number(process.env.WORKER_CONCURRENCY) || 10 }
  );
  worker.on('completed', (job) => logger.info({ jobId: job.id, jobName: job.name }, 'Job completed.'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, jobName: job?.name, err }, 'Job failed.'));
  return worker;
}

module.exports = { enqueue, registerHandler, startWorker, getQueue, QUEUE_NAME };
