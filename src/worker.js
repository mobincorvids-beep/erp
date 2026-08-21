/**
 * Background job worker — a separate process/container from the API
 * (`src/server.js`), started with `npm run worker`. This is the actual
 * mechanism by which async work (webhook delivery, document-expiry
 * sweeps, FBR retry) scales independently of HTTP traffic: at 10,000
 * concurrent checkouts, you scale API replicas for request throughput and
 * worker replicas for job throughput separately, instead of one process
 * type doing both and neither scaling correctly for its own bottleneck.
 *
 * Requires REDIS_URL — without it there's no durable queue to work off of
 * (see queue.js's inline fallback, which runs jobs directly inside
 * whichever process called enqueue() instead). Also connects to MongoDB
 * since every job handler reads/writes real data.
 */
require('dotenv').config();
const { validateEnv } = require('./config/validateEnv');
validateEnv();

const connectDB = require('./config/db');
const { startWorker } = require('./queue/queue');
const { scheduleRepeatingJobs } = require('./queue/jobs');
const { logger } = require('./lib/logger');

require('./queue/jobs'); // side-effecting require: registers all job handlers

async function main() {
  if (!process.env.REDIS_URL) {
    logger.error('REDIS_URL is not set — the worker process has nothing to do (no queue to consume from). Set REDIS_URL and re-run, or don\'t run this process at all for a single-instance deployment (jobs then run inline in the API process).');
    process.exit(1);
  }

  await connectDB();
  const worker = startWorker();
  await scheduleRepeatingJobs();
  logger.info({ concurrency: Number(process.env.WORKER_CONCURRENCY) || 10 }, 'Worker started, consuming erp-jobs queue.');

  function shutdown(signal) {
    logger.info({ signal }, 'Worker shutting down gracefully — finishing in-flight jobs.');
    worker.close().then(() => require('mongoose').connection.close(false)).then(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start.');
  process.exit(1);
});
