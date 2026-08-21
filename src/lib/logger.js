/**
 * Structured JSON logging — `console.log`/`console.error` scattered across
 * services works fine for one instance's terminal, but is unusable once
 * you're running dozens of replicas: there's no request correlation, no
 * log level filtering, and every log aggregator (CloudWatch, Datadog, an
 * ELK stack) has to regex-parse free-text lines instead of querying real
 * fields. `pino` produces one JSON object per line, which every one of
 * those tools ingests natively.
 *
 * Deliberately additive — this does not replace the `console.log` calls
 * throughout the existing services (that's hundreds of call sites this
 * project's own README describes as individually hand-verified; rewriting
 * them all is a real, separate, much larger change, not something to do
 * as a side effect of adding scale infrastructure). New code (the queue,
 * the worker, request correlation) uses this; existing services keep
 * working exactly as before.
 */
const pino = (() => {
  try {
    return require('pino');
  } catch (e) {
    return null;
  }
})();

const base = pino
  ? pino({ level: process.env.LOG_LEVEL || 'info' })
  : {
      // Same four methods pino exposes, falling back to console so nothing
      // throws if the dependency isn't installed yet.
      info: (...a) => console.log(...a),
      warn: (...a) => console.warn(...a),
      error: (...a) => console.error(...a),
      debug: (...a) => (process.env.LOG_LEVEL === 'debug' ? console.log(...a) : undefined),
      child: () => base,
    };

/** A logger pre-bound with request-scoped fields (id, companyId once auth runs) so every line from one request can be grepped/queried together across a fleet of replicas. */
function forRequest(req) {
  return base.child({ requestId: req.id, companyId: req.user?.companyId });
}

module.exports = { logger: base, forRequest };
