/**
 * Cache-aside helper for read paths where a few seconds of staleness is a
 * genuinely acceptable trade for not hitting MongoDB on every request —
 * the industries/module catalog (static reference data, not per-tenant)
 * is the first real user, wired into `GET /api/v1/org/industries`.
 *
 * Deliberately NOT used anywhere near checkout, stock levels, ledgers, or
 * anything else this codebase's own README repeatedly treats as needing
 * to be exactly correct, not eventually correct — this is a tool for
 * genuinely cache-safe reads, not a general-purpose speedup applied
 * everywhere without thinking about what it costs. With no REDIS_URL
 * configured, `getOrSet()` just calls `fn()` every time — identical to
 * this app's behavior before this file existed.
 */
const { getRedis } = require('../config/redis');

async function getOrSet(key, ttlSeconds, fn) {
  const redis = getRedis();
  if (!redis) return fn();

  try {
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached);
  } catch (err) {
    console.error('Cache read failed, falling through to source:', err.message);
  }

  const value = await fn();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('Cache write failed (value already computed and returned correctly):', err.message);
  }

  return value;
}

/** Call after any write that would make a cached key stale — e.g. an industry manifest changing at deploy time. */
async function invalidate(key) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.error('Cache invalidation failed:', err.message);
  }
}

module.exports = { getOrSet, invalidate };
