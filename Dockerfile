# NOTE: written to standard Docker/Node best practices but never actually
# built or run — this sandbox has no Docker daemon and its network
# allowlist blocks Docker Hub itself (registry-1.docker.io returns
# host_not_allowed), so there was no way to verify this here. Build it
# once locally (`docker build -t pos-erp-api .`) before relying on it.

FROM node:20-alpine AS deps
WORKDIR /app
# Copy only the manifest first so this layer is cached and skipped on
# every rebuild that doesn't touch dependencies — the single biggest lever
# for fast iterative builds.
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as a non-root user — the "node" user/group ships built into the
# official image for exactly this purpose. Never run an internet-facing
# process as root inside a container if it can be avoided.
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
USER node

EXPOSE 4000

# Matches GET /healthz in src/server.js — deliberately liveness, not
# readiness (see the comment on that route): this answers "is the process
# itself alive", with no dependency checks, so a transient MongoDB/Redis
# blip doesn't cause Docker/an orchestrator to kill and restart an
# otherwise-healthy container, which would only make a downstream outage
# worse. /readyz (dependency-checked) is what a load balancer or k8s
# readiness probe should point at instead, to stop routing traffic without
# restarting anything.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/healthz', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
