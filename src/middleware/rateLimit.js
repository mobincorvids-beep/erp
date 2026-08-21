const rateLimit = require('express-rate-limit');
const { getRedis } = require('../config/redis');

/**
 * Two tiers: a generous general limit so normal API use never hits it, and
 * a much stricter one specifically on login endpoints — brute-forcing a
 * password is the attack rate limiting actually needs to stop, so login
 * gets its own tighter budget rather than sharing the general one.
 *
 * The store is the real scale fix here. `express-rate-limit`'s default
 * store is an in-process Map — correct for exactly one instance. The
 * moment this API runs as N replicas behind a load balancer (which is the
 * entire point of a horizontally-scaled deployment), each replica counts
 * requests independently: an attacker distributed across N replicas gets
 * N times the real budget, and a legitimate client whose requests land on
 * different replicas (round-robin, no sticky sessions) can get rate-limited
 * incorrectly even though their true request rate is well under the limit.
 * A shared Redis store (`rate-limit-redis`) makes every replica enforce the
 * same real, global counter. Falls back to the in-memory store when
 * REDIS_URL isn't set — correct behavior for a single-instance/local-dev
 * deployment, and exactly what this app did before Redis support existed.
 */
function buildStore() {
  const redis = getRedis();
  if (!redis) return undefined; // express-rate-limit's own default in-memory store
  try {
    const { RedisStore } = require('rate-limit-redis');
    return new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: 'rl:',
    });
  } catch (e) {
    console.warn('REDIS_URL is set but "rate-limit-redis" is not installed — run `npm install`. Falling back to per-instance in-memory rate limiting.');
    return undefined;
  }
}

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // ~40 req/min sustained — comfortable for a POS terminal, not for a scraper
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and try again shortly.' },
  store: buildStore(),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 login attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please wait a few minutes before trying again.' },
  skipSuccessfulRequests: true, // only failed attempts count against the budget
  store: buildStore(),
});

module.exports = { generalLimiter, authLimiter };
