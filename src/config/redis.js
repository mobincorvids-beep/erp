/**
 * Shared Redis client — the one piece of infrastructure a horizontally
 * scaled deployment of this app actually needs beyond MongoDB. Three real
 * uses, all wired elsewhere: a distributed rate-limit store (so N API
 * replicas share one request budget instead of each enforcing its own,
 * which silently multiplies the effective limit by N), a cache-aside layer
 * for expensive read paths, and the backing store for the BullMQ job
 * queue (`src/queue/queue.js`).
 *
 * Deliberately optional, not required. `REDIS_URL` unset means every
 * caller of `getRedis()` gets `null` back, and every module that consumes
 * this (rate limiting, caching, the queue) has its own in-process fallback
 * — so a single-instance / local-dev deployment with no Redis at all keeps
 * working exactly as this app did before this file existed. Redis becomes
 * necessary only once you actually run more than one API replica, which is
 * the point at which in-memory state stops being correct anyway.
 */
const IORedis = (() => {
  try {
    return require('ioredis');
  } catch (e) {
    return null; // dependency not installed yet (e.g. before `npm install` picks up the new package.json entry) — degrade instead of crashing require()
  }
})();

let client = null;
let attempted = false;

function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!IORedis) {
    if (!attempted) console.warn('REDIS_URL is set but the "ioredis" package is not installed — run `npm install` to pick it up. Falling back to in-process behavior everywhere.');
    attempted = true;
    return null;
  }
  if (!client) {
    client = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3, // fail a single command fast rather than queueing it forever against a dead Redis — callers fall back to their own in-process path on error
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: false,
    });
    client.on('error', (err) => console.error('Redis connection error:', err.message));
    client.on('connect', () => console.log('Redis connected.'));
  }
  return client;
}

/** For readiness probes — never throws, resolves to a plain boolean. */
async function pingRedis() {
  const redis = getRedis();
  if (!redis) return true; // Redis not configured is a valid, supported deployment shape — not a failure
  try {
    await redis.ping();
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { getRedis, pingRedis };
