# Kubernetes deployment — horizontal scale-out

Apply in order (the numeric prefixes are the intended order, not
arbitrary):

```bash
kubectl apply -f infra/k8s/00-namespace.yaml
kubectl apply -f infra/k8s/01-configmap.yaml
cp infra/k8s/02-secret.example.yaml infra/k8s/02-secret.yaml   # fill in real values first
kubectl apply -f infra/k8s/02-secret.yaml
kubectl apply -f infra/k8s/06-redis.yaml   # or skip this and point REDIS_URL at a managed Redis instead — see that file's own comment
kubectl apply -f infra/k8s/03-api.yaml
kubectl apply -f infra/k8s/04-hpa.yaml
kubectl apply -f infra/k8s/05-worker.yaml
kubectl apply -f infra/k8s/07-client.yaml
kubectl apply -f infra/k8s/08-ingress.yaml
```

Never actually applied against a live cluster from this sandbox — no
`kubectl` and no cluster reachable here. Every manifest is validated as
real, parseable YAML (`python3 -c "import yaml; ..."` against every file
in this directory, all pass) and written directly against the fields each
resource type actually documents, not guessed from memory — validate with
`kubectl apply --dry-run=server` against a real cluster before trusting it
further than that.

## Why this shape

The API tier (`03-api.yaml`) is stateless by design, not by accident —
auth is JWT + a `RefreshToken` collection in Mongo (see
`src/services/refreshTokenService.js`), not an in-process session store,
so **any** replica can serve **any** request with no sticky routing and no
shared local state. That single property is what makes `04-hpa.yaml`'s
autoscaling actually work: a new replica is immediately as capable as an
existing one, with zero warm-up beyond the container starting and its
Mongo/Redis connections opening.

Async side effects (webhook delivery, the document-expiry and FBR-retry
sweeps — see `src/queue/`) run in a **separate** worker tier (`05-worker.yaml`)
that scales independently of request traffic, because job-processing load
and HTTP-request load don't correlate — a backlog of slow webhook
deliveries shouldn't force scaling up the pods answering POS checkouts,
and vice versa.

## What this does NOT solve, stated honestly

- **MongoDB itself isn't in these manifests as a production-grade
  service.** Running your own single-node Mongo in-cluster (what
  `docker-compose.yml`'s `mongo` service does, fine for local dev) is not
  what a deployment claiming to handle real, sustained scale should run in
  production — no automatic failover, no read replicas, one node's disk
  failure is real data loss. Use a managed service (MongoDB Atlas,
  DocumentDB) or a properly operated replica-set/sharded-cluster setup
  (the MongoDB Community/Enterprise Kubernetes Operator, run by someone
  who owns that operational burden). `MONGO_READ_PREFERENCE=secondaryPreferred`
  (wired in `src/config/db.js`) is ready to route read-heavy traffic
  (reports, dashboards) to secondaries the moment a real replica set is
  behind `MONGO_URI` — it's a no-op against a single-node Mongo.
- **Sharding a single MongoDB deployment has a real ceiling.** At
  genuinely extreme write volume, the honest next step is sharding
  `Sale`/`Voucher`/`StockMovement` by `companyId` (every write in this
  schema is already company-scoped — see the multi-tenant design
  throughout `src/models/`), which MongoDB supports natively via a
  compound shard key like `{ companyId: 1, _id: 1 }`. Not configured here
  — it's an operational decision to make once you actually have the write
  volume that needs it, not something to pre-optimize before you do.
- **The single Redis in `06-redis.yaml` is not highly available.** One pod,
  one PVC — losing it loses in-flight rate-limit windows and queued jobs
  (BullMQ's own Redis persistence covers job durability if Redis itself
  survives a pod restart with its PVC intact, but not a lost PVC). A
  managed Redis (ElastiCache, Memorystore) with real replication is the
  production answer; this manifest is "it works", not "it's resilient."
- **Multi-region is not configured here.** The real path: deploy this same
  namespace's manifests into a second cluster in a second region, point
  both at one MongoDB Atlas cluster with cross-region read replicas
  (`MONGO_READ_PREFERENCE=nearest` for read traffic to prefer the local
  region) and a single primary region for writes, and use DNS-based or
  Anycast routing (Route 53 latency routing, Cloudflare) in front of both
  regions' ingress. Genuine active-active writes across regions would mean
  either accepting eventual consistency on the ledger (unacceptable for
  double-entry accounting — see `accountingService.postVoucher()`'s own
  balance-must-match-exactly guarantee) or a real distributed-consensus
  layer, which is a materially different, much larger architecture change
  than infrastructure config — not attempted here, and said so directly
  rather than implied.
- **"Billions of users" is not a real requirement to hold this design to,
  and the report (`docs/`) says so.** No ERP on Earth serves a billion
  concurrent users — the entire addressable market of businesses running
  ERP/POS software is in the tens of millions globally. What this
  architecture actually delivers is a **ceiling that scales by adding
  replicas, not by rewriting the app** — the honest, useful version of
  "won't crash under real load," sized to what a platform like this could
  plausibly need: many thousands of tenant companies, each with anywhere
  from one POS terminal to thousands of concurrent staff, served correctly
  under one shared, horizontally-elastic fleet.
