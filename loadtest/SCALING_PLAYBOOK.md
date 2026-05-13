# Mento Scaling Playbook

Capacity planning guide for reaching 10 M MAU.
Every number here is a derived estimate — measure and adjust as real traffic data accumulates.

---

## 1. Back-of-envelope: 10 M MAU to peak RPS

| Assumption | Value | Notes |
|---|---|---|
| Monthly active users (MAU) | 10,000,000 | Target post-campaign |
| Daily active rate (DAU/MAU) | 20% | Conservative for exam-prep verticals |
| DAU | 2,000,000 | |
| Sessions per DAU per day | 3 | Morning check-in, study block, evening review |
| Requests per session | 12 | List view + detail + chat + journal = 12 avg |
| Total daily requests | 72,000,000 | |
| Avg requests per second (24h) | 833 req/s | |
| Peak-hour traffic factor | 5× | 7–9 PM IST is UPSC prime time |
| Peak RPS | ~4,170 req/s | |
| Peak requests per minute | ~250,000 | |
| Peak requests per hour | ~15,000,000 | |

These numbers drive everything below.

---

## 2. Bottleneck candidates

### 2.1 OTP rate limiter (Twilio / MSG91)
- SMS OTP uses an external provider. At 10 M MAU, signup spikes can hit
  **50k–100k OTP requests in a 15-minute campaign window**.
- Current Throttler (NestJS, in-memory or Redis-backed) is per-IP; during a
  promotional campaign, many users share the same ISP NAT IP.
- **Risk**: SMS provider rate caps (MSG91 free: 25 OTP/min; paid: negotiated).
- **Mitigation**: Pre-provision OTP credits; whitelist campaign IPs in Throttler.

### 2.2 Postgres connection pool
- NestJS + Prisma uses a connection pool (default: `5` connections per process).
- At 4,170 RPS with a p95 DB query time of ~20 ms, the expected concurrent
  queries are: `4170 × 0.020 = 83 queries/ms` → **need ~100 pool connections**.
- Single `pg` instance (8 vCPU) supports ~200–400 connections before OOM.
- **Risk**: Connection exhaustion → `P2024` Prisma timeout errors.
- **Mitigation**: PgBouncer in transaction-pool mode (see §3).

### 2.3 Redis pub-sub fanout (Socket.IO chat)
- Every chat message emits to `conv:<id>` and `user:<id>` rooms via the
  Socket.IO Redis adapter.
- At 500 concurrent active chatters (1% of 50k online), each message triggers
  2 Redis PUBLISH operations. `500 × 10 msg/min = 5,000 pub/min = 83 pub/s`.
- Redis can handle ~100k pub-sub ops/s on a single node — not a bottleneck until
  ~100k concurrent chatters, but the adapter adds memory pressure per subscriber.
- **Risk**: Memory OOM on Redis at very high Socket.IO presence count.
- **Mitigation**: Redis Cluster (split keyspace by conversation prefix), limit
  presence fanout to conversation participants only (already implemented in gateway).

### 2.4 Socket.IO horizontal sharding
- The Redis adapter is guarded by `SOCKET_REDIS_ADAPTER=true` env var.
  **This must be set in production** or multi-instance Socket.IO rooms break.
- Socket.IO server affinity: sticky sessions required (Caddy upstream hash by
  `X-Forwarded-For` or cookie) so reconnects hit the same API node.
- **Risk**: Room join/leave events lost across nodes without adapter → missed
  presence, missed `message:new` push to recipient room.
- **Mitigation**: Enable adapter, enable sticky sessions (see §3).

### 2.5 NestJS event-loop blocking
- `better-sqlite3` is synchronous and **blocks the Node.js event loop**. Mento uses
  Postgres (async), not SQLite, so this is not an issue here — but check if any
  utility module imports `better-sqlite3` transitively.
- High concurrency with synchronous Prisma calls that do many round-trips
  (e.g., `$transaction` chains) can create back-pressure.
- **Mitigation**: Increase `UV_THREADPOOL_SIZE` (see §3); profile with `clinic.js`.

---

## 3. Recommended config knobs

### PgBouncer (connection pooling)
```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
mento = host=localhost port=5432 dbname=mento

[pgbouncer]
pool_mode = transaction       ; stateless — required for Prisma
max_client_conn = 2000        ; max inbound connections from app
default_pool_size = 80        ; connections to Postgres per DB
min_pool_size = 10
reserve_pool_size = 20
reserve_pool_timeout = 3
server_idle_timeout = 600
log_connections = 0           ; disable in prod for perf
```

Prisma connection string: `postgresql://mento:mento@localhost:5432/mento?pgbouncer=true`
Set `connection_limit` in `DATABASE_URL` to match PgBouncer `max_client_conn`:
```
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=80"
```

### Redis Cluster (for >50k concurrent socket users)
- Use `ioredis` Cluster mode (`new Redis.Cluster([...nodes])`).
- Socket.IO adapter supports Cluster via `@socket.io/redis-adapter` v8+.
- Split keyspace: chat keys under `{chat}:*`, presence under `{presence}:*`.

### Caddy worker count + sticky sessions
```caddyfile
# Caddyfile (prod)
api.mento.app {
    reverse_proxy {
        to localhost:4000 localhost:4001 localhost:4002

        # Sticky sessions for Socket.IO
        lb_policy ip_hash

        # Health checks
        health_uri /healthz
        health_interval 10s
        health_timeout 5s
    }
}
```

### Node.js UV_THREADPOOL_SIZE
The default UV thread pool size is 4. DNS lookups, filesystem operations, and
some crypto operations use this pool. With high concurrency:
```bash
# In your systemd unit or Dockerfile CMD
Environment=UV_THREADPOOL_SIZE=64
```
Empirically effective at ~500 concurrent VUs; tune upward if `uv_threadpool_stall`
appears in `clinic.js` flame graphs.

### NestJS Throttler (rate limit tiers)
Current config (from `AppModule`): verify in `apps/api/src/app.module.ts`.
Recommended prod settings:
```typescript
ThrottlerModule.forRoot([
  { name: 'short',  ttl: 1000,  limit: 20  },  // 20 req/s per IP
  { name: 'medium', ttl: 60000, limit: 200 },   // 200 req/min per IP
  { name: 'long',   ttl: 3600000, limit: 2000 },// 2000 req/hour per IP
])
```
OTP endpoints need their own guard with tighter limits (5 OTPs/phone/hour).

---

## 4. "When to scale up" triggers

Monitor these in Grafana/CloudWatch. Trigger a scale event when **any** of the
following is sustained for 5 consecutive minutes:

| Metric | Warning threshold | Action threshold |
|---|---|---|
| API P95 latency (all endpoints) | > 400 ms | > 700 ms |
| API P99 latency | > 800 ms | > 1500 ms |
| HTTP error rate | > 0.5% | > 2% |
| Postgres active connections | > 70% of pool_size | > 90% |
| Postgres query time P95 | > 50 ms | > 100 ms |
| Redis memory used | > 60% of maxmemory | > 80% |
| Redis pub-sub message lag | > 100 ms | > 500 ms |
| Node.js event-loop lag | > 50 ms | > 200 ms |
| CPU utilisation (per node) | > 70% | > 85% |
| OTP request 429 rate | > 1% | > 5% |

---

## 5. Capacity tiers

### Dev (local sandbox)
- 1 vCPU, 2 GB RAM
- Single API process, Postgres direct (no PgBouncer), Redis standalone
- Suitable for: functional tests, single-user dev
- k6 max VUs before degradation: ~30–50 VUs

### Staging (4 vCPU, 8 GB RAM)
- 2× API processes behind Caddy, PgBouncer with pool_size=40
- Redis standalone, `SOCKET_REDIS_ADAPTER=true`
- Suitable for: pre-release load testing, capacity validation
- k6 max VUs before degradation: ~200–300 VUs
- Expected throughput: ~500 RPS

### Prod-soft launch (8 vCPU, 16 GB RAM, 1 replica)
- 4× API processes (Node cluster), PgBouncer pool_size=80
- Postgres primary + 1 read replica (route `GET /mentors`, `GET /journals` to replica)
- Redis standalone with 4 GB maxmemory
- Suitable for: 0–2 M MAU
- Expected throughput: ~2,000 RPS sustained

### Prod-scale (k8s autoscale)
- HPA: target CPU 60%, min 3 pods, max 20 pods
- Postgres: RDS db.r7g.2xlarge (8 vCPU, 64 GB) + PgBouncer sidecar
- Redis: ElastiCache cluster mode, 3 shards × 2 replicas
- CDN: CloudFront in front of `/mentors` (cache TTL 60 s with `Vary: Authorization`)
- Suitable for: 2 M–10 M+ MAU
- Expected throughput: 4,000+ RPS sustained, burst to 10,000 RPS

---

## 6. Caching strategy for hot read paths

| Endpoint | Cache layer | TTL | Invalidation |
|---|---|---|---|
| `GET /mentors` | Redis (per filter fingerprint) | 60 s | On mentor profile update |
| `GET /mentors/:id` | Redis | 120 s | On mentor profile update |
| `GET /conversations` | None (user-specific, low benefit) | — | — |
| `GET /conversations/:id/messages` | Redis (first page only) | 30 s | On `message:send` |
| `GET /journals` | None (user-specific) | — | — |

To implement Redis response caching, add a `CacheInterceptor` in NestJS or a
thin Redis middleware in the Express layer. Use `X-Cache: HIT/MISS` headers to
monitor effectiveness.

---

## 7. Pre-launch checklist

- [ ] `SOCKET_REDIS_ADAPTER=true` set in production env
- [ ] PgBouncer deployed and `DATABASE_URL` updated to point to it
- [ ] Caddy `lb_policy ip_hash` enabled for Socket.IO sticky sessions
- [ ] `UV_THREADPOOL_SIZE=64` in systemd unit
- [ ] Sentry DSN configured and `SENTRY_DSN_API` set
- [ ] Throttler limits tightened for OTP endpoints (5/phone/hour)
- [ ] Read replica added for mentor discovery queries
- [ ] Redis `maxmemory-policy allkeys-lru` set (not the default `noeviction`)
- [ ] k6 mixed scenario passes with 500 VUs against staging before each release
- [ ] Grafana dashboard deployed with all thresholds from this playbook as alert rules
