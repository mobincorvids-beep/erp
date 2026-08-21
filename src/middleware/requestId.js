/**
 * Assigns a request-correlation id and echoes it back as `X-Request-Id`.
 * Trusts an inbound `X-Request-Id` header when present — a load balancer
 * or API gateway in front of this app can generate the id once and have
 * it survive retries/redelivery, letting one client-visible request be
 * traced across every replica and service (API, worker, webhook delivery)
 * it touches. Falls back to generating one when the caller doesn't supply
 * it (e.g. hitting the API directly in dev).
 */
const crypto = require('crypto');

function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = requestId;
