# Mento — Runbook

> Common commands + troubleshooting. Bookmarks for things you'll forget.
>
> For production deployment (provisioning, first-deploy, updates, rollback, backups)
> see **[docs/DEPLOY.md](./DEPLOY.md)**.

## First-time setup on a fresh machine

```bash
git clone <repo> /root/Mento
cd /root/Mento
pnpm install
cp .env.example .env
# Edit .env if you want admin bootstrap or non-default values

# Start local DBs (non-default ports to avoid conflicts)
docker compose -f infra/docker/docker-compose.local.yml up -d

# Push schema (no migration file needed for dev)
cd apps/api && pnpm prisma db push --accept-data-loss
cd ../..

# Seed admin user (optional — admin login phone must match ADMIN_BOOTSTRAP_PHONE)
pnpm --filter @mento/api db:seed

# Run everything
pnpm dev
```

## Day-to-day

```bash
# Start DBs
pnpm db:up

# Stop DBs (keeps data)
pnpm db:down

# Tail DB logs
pnpm db:logs

# Run dev servers (turbo runs api + web + mobile in parallel)
pnpm dev

# Run individual apps
pnpm --filter @mento/api dev
pnpm --filter @mento/web dev
pnpm --filter @mento/mobile dev    # Expo: press w for web, i for iOS sim, a for Android emu

# Typecheck a single app (recommended — avoid root-level pnpm typecheck)
cd apps/api && pnpm typecheck
cd apps/web && pnpm typecheck
cd apps/mobile && pnpm typecheck

# Format
pnpm format

# Reset DB to empty + re-apply schema
docker compose -f infra/docker/docker-compose.local.yml down -v
docker compose -f infra/docker/docker-compose.local.yml up -d
cd apps/api && pnpm prisma db push --accept-data-loss
```

## Common URLs

| Service | URL |
|---|---|
| API | http://localhost:4000 |
| API health | http://localhost:4000/healthz |
| API metrics (docker-internal only) | http://api:4000/metrics |
| Web | http://localhost:3030 |
| Expo dev server | http://localhost:8081 |
| Expo Web | http://localhost:8081 (press `w`) |
| Postgres | localhost:5433, user `mento`, password `mento`, db `mento` |
| Redis | localhost:6380 |

## Scraping Prometheus metrics

The API exposes metrics at `GET /metrics`. This endpoint is intentionally public
(no auth) so the Prometheus scraper can reach it without a bearer token. The
Caddyfile 403s the public route — only the internal docker network can reach it.

### Verify metrics (inside docker network)

```bash
# From any container on the same docker network:
curl http://api:4000/metrics

# From the host (dev only — Caddy is not in front of localhost:4000):
curl http://localhost:4000/metrics
```

### Example prometheus.yml scrape config

```yaml
scrape_configs:
  - job_name: mento_api
    scrape_interval: 15s
    scrape_timeout: 10s
    static_configs:
      - targets:
          - api:4000   # docker-internal — never goes through Caddy
    metrics_path: /metrics
```

Add this service to your `docker-compose.prod.yml`:

```yaml
  prometheus:
    image: prom/prometheus:v2.54.1
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    networks:
      - internal
    restart: unless-stopped
```

Prometheus must be on the same `internal` network as `api`. Do **not** expose
the Prometheus port publicly — use an internal Grafana instance to query it.

See `docs/ALERTING.md` for alert rules and Sentry integration details.

## Test auth flow via curl

```bash
# 1. Request OTP (dev mode returns devCode in response and prints to api console)
PHONE='+919876543210'
RESP=$(curl -s -X POST http://localhost:4000/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\"}")
echo "$RESP"
CODE=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["devCode"])')

# 2. Verify OTP -> get tokens
SESSION=$(curl -s -X POST http://localhost:4000/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}")
echo "$SESSION"
ACCESS=$(echo "$SESSION" | python3 -c 'import sys,json;print(json.load(sys.stdin)["tokens"]["accessToken"])')

# 3. Call protected endpoint
curl -s http://localhost:4000/me -H "Authorization: Bearer $ACCESS"
```

## Schema changes

```bash
# Edit apps/api/prisma/schema.prisma
# Then push to dev DB:
cd apps/api && pnpm prisma db push --accept-data-loss

# Regenerate Prisma client (usually automatic):
pnpm prisma generate

# Create a proper migration (when ready for prod):
pnpm prisma migrate dev --name <descriptive_name>
```

## Sentry CLI post-install scripts

`@sentry/cli` requires a native binary download that pnpm's sandbox normally blocks.
The root `package.json` now lists it (along with `esbuild`, `sharp`, `prisma`, and a
few other packages that need post-install scripts) under `pnpm.onlyBuiltDependencies`.
This allows their install scripts to run without disabling the full sandbox.

If you see `@sentry/cli: command not found` after a fresh `pnpm install`:

```bash
cd /root/Mento
pnpm rebuild @sentry/cli
```

This is safe — `onlyBuiltDependencies` explicitly permits it.

## Production sourcemaps

Sentry sourcemap upload runs as an optional step in the `build-web` CI job
(`.github/workflows/ci.yml`). It only executes when all three secrets are present:
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`. If any are missing the step
is silently skipped and the build still succeeds.

The upload command is:

```bash
pnpm dlx @sentry/cli sourcemaps upload \
  --release="$GITHUB_SHA" \
  --auth-token="$SENTRY_AUTH_TOKEN" \
  --org="$SENTRY_ORG" \
  --project="$SENTRY_PROJECT" \
  apps/web/.next
```

To configure:
1. Create a Sentry internal integration token with `project:releases` + `org:read` scopes.
2. Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` as repository secrets in
   GitHub (Settings → Secrets → Actions).
3. Confirm the next CI run picks up the upload step (check the "Build web" job log).

The Next.js `next.config.mjs` conditionally wraps with `withSentryConfig` when
`SENTRY_AUTH_TOKEN` is set at build time, which also injects the release identifier.
Standalone Docker builds pass the token in via `build-args` in `docker-compose.prod.yml`.

## Troubleshooting

### "Command 'prisma' not found"
You're in the wrong directory. Prisma needs `apps/api`. Always `cd /root/Mento/apps/api` first.

### "Shell cwd was reset to /root/Mento" but commands still fail
Sandbox quirk — the message lies; cwd is actually `/root/GeekSpace2.0`. Always use `cd /root/Mento/<...> && ...` or absolute paths.

### "Port already in use"
Other containers on this host bind 6379, 3000, 5432. Mento uses 6380, 3030, 5433. If a port still conflicts, check `docker ps` and adjust ports in `infra/docker/docker-compose.local.yml`.

### Login works but `/me` returns 401
Health endpoints need `@Public()`. If you added a controller without it, the global JWT guard will block. Check `apps/api/src/modules/<X>/<X>.controller.ts`.

### Web onboarding loops back to /login
Either `localStorage.mento.access` is missing, or `/onboarding/state` is returning a `nextStep` you don't have a route for. Inspect the request in DevTools.

### Mobile Expo Go shows "Network response timed out"
The OTP came from `localhost:4000` but Expo Go on a physical device can't reach localhost. Set `EXPO_PUBLIC_API_URL` to your laptop's LAN IP (e.g., `http://192.168.1.42:4000`) and restart Expo.

### Letter avatar shows wrong letter after onboarding
The avatar letter is set based on `journeyStage` on Mirror submit, or `journeyType` on mentor submit. Check `apps/api/src/common/anonymity.ts` for the rules. Re-run onboarding to update.

### Typecheck succeeds locally but root `pnpm typecheck` fails with three.js errors
That's `/root/GeekSpace2.0`'s typecheck (cwd reset issue). Ignore. Always typecheck per-app inside `apps/<app>`.

## Running load tests

Load tests live in `loadtest/` at the repo root. Full documentation: [`loadtest/README.md`](../loadtest/README.md).

### Prerequisites
- k6 installed (`brew install k6`) or Docker available
- API running in **dev mode** (`NODE_ENV=development`) so `devCode` is returned in OTP responses — no real SMS is sent
- Local infra up (`pnpm db:up`)

### Quick start (dev box)
```bash
# Smoke test — onboarding flow, 50 VUs, 2.5 minutes
k6 run loadtest/k6/01-onboarding.js

# Full mixed scenario — 500 VUs, 6 minutes (warning: CPU-intensive on dev box)
k6 run loadtest/k6/05-mixed-realistic.js

# Via Docker (no local k6 install needed)
pnpm loadtest
```

### Against staging
```bash
k6 run -e BASE_URL=https://staging.mento.app loadtest/k6/05-mixed-realistic.js
```

### Save results for comparison
```bash
k6 run --out json=loadtest/results/run-$(date +%Y%m%d-%H%M).json \
  loadtest/k6/05-mixed-realistic.js
```

### SLO targets summary
| Endpoint group | P95 target | Error budget |
|---|---|---|
| Auth (OTP request + verify) | < 500 ms | 0.1% |
| Mentor discovery | < 200 ms | 0.1% |
| Chat reads | < 300 ms | 0.1% |
| Journal writes | < 400 ms | 0.1% |
| Mixed aggregate | P95 < 500 ms, P99 < 1000 ms | 0.5% |

See [`loadtest/SCALING_PLAYBOOK.md`](../loadtest/SCALING_PLAYBOOK.md) for capacity planning,
bottleneck analysis, and "when to scale up" triggers.

## Performance — indexes and caching

### Analytics partial indexes (critical at scale)

Two partial B-tree indexes exist on `User.createdAt` and `Message.createdAt`:

```sql
"User_createdAt_idx"    ON "User"("createdAt" DESC) WHERE "deletedAt" IS NULL
"Message_createdAt_idx" ON "Message"("createdAt" DESC) WHERE "deletedAt" IS NULL
```

These are used by the analytics service's daily-signup and daily-message `DATE_TRUNC`
groupBy queries. At 10 M MAU the planner will use these indexes instead of a full
sequential scan on the `User` / `Message` tables.

Migration file: `apps/api/prisma/migrations/20260513010000_perf_indexes_analytics/migration.sql`

Apply to a fresh DB:
```bash
docker exec mento-postgres-local psql -U mento -d mento \
  -f /path/to/migration.sql
# or just run prisma migrate deploy which picks up all pending migrations
```

Verify they exist:
```bash
docker exec mento-postgres-local psql -U mento -d mento \
  -c "SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('User_createdAt_idx','Message_createdAt_idx');"
```

### Socket.IO horizontal scaling (SOCKET_REDIS_ADAPTER)

Set `SOCKET_REDIS_ADAPTER=true` in production to activate the `@socket.io/redis-adapter`.
Without it, Socket.IO uses the in-memory adapter — fine for a single node but **breaks
presence and message fanout when running more than one API pod**.

The env is already set in `infra/docker/docker-compose.prod.yml`. On a fresh prod deploy
confirm the API logs print:

```
[ChatGateway] Socket.IO Redis adapter attached
```

If you see that line, horizontal scaling is active. If you don't, check `REDIS_URL` is
reachable and `SOCKET_REDIS_ADAPTER` is literally the string `"true"`.

### Mentor-list 30-second Redis cache

`GET /mentors` responses are cached in Redis for 30 seconds with key prefix
`mentors:list:`. This means:

- A newly approved mentor takes **up to 30 s** to appear in the public listing.
- This is intentional — mentor approvals are rare, 30 s lag is acceptable.
- The admin approve / reject / ban endpoints **actively bust the cache** immediately
  after the transaction commits, so the lag is usually < 1 s in practice.
- If you need to force-clear the cache manually:
  ```bash
  redis-cli -p 6380 KEYS 'mentors:list:*' | xargs redis-cli -p 6380 DEL
  ```

## Releasing mobile updates

Full walkthrough: **[docs/DEPLOY.md §9](./DEPLOY.md#9-mobile-builds-eas)**

Quick reference:

```bash
# Preview build (Android APK — for internal QA)
cd /root/Mento/apps/mobile && pnpm dlx eas-cli build --profile preview --platform android

# Production build (both platforms — submits to EAS queue)
pnpm dlx eas-cli build --profile production --platform all

# Submit to stores after a successful production build
pnpm dlx eas-cli submit --profile production --platform ios
pnpm dlx eas-cli submit --profile production --platform android

# OTA JS-only update (no store review needed)
pnpm dlx eas-cli update --channel production --message "Describe what changed"

# Check build status
pnpm dlx eas-cli build:list --limit 5
```

Key files:
- `apps/mobile/eas.json` — EAS build profiles
- `apps/mobile/app.json` — app identifiers, plugins, runtime version
- `apps/mobile/STORE.md` — App Store / Play Store listing copy
- `apps/mobile/store-screenshots/README.md` — screenshot spec for designer

---

## Backup local DB

```bash
docker exec mento-postgres-local pg_dump -U mento mento | gzip > mento-$(date +%Y%m%d).sql.gz
```

## Restore local DB

```bash
gunzip -c mento-YYYYMMDD.sql.gz | docker exec -i mento-postgres-local psql -U mento -d mento
```

---

## Backups

### Overview

Production backups are managed by `scripts/backup-pg.sh`. The script:
- Runs `pg_dump` inside the `mento-postgres-prod` container.
- Writes a gzip-compressed dump to `/srv/mento/backups/mento-YYYYMMDD-HHMMSS.sql.gz`.
- Optionally uploads to Cloudflare R2 / AWS S3 when `BACKUP_S3_BUCKET` is set in `.env.prod`.
- Prunes local files older than 7 days.
- Logs every action to syslog (`logger -t mento-backup`).

### Cron schedule

A daily backup at 02:00 UTC is recommended. Add to `/etc/cron.d/mento-backup`:

```
0 2 * * * root /srv/mento/scripts/backup-pg.sh >> /var/log/mento-backup.log 2>&1
```

Verify cron is picking it up:

```bash
grep mento-backup /var/log/syslog | tail -20
```

### Run a manual backup

```bash
/srv/mento/scripts/backup-pg.sh
```

### Restore-from-backup runbook

**Stop the API first.** Restoring while the API is healthy will corrupt in-flight writes.

1. Stop the API container:
   ```bash
   docker stop mento-api-prod
   ```

2. Identify the backup file to restore:
   ```bash
   ls -lh /srv/mento/backups/
   ```

3. Run the restore script:
   ```bash
   /srv/mento/scripts/restore-pg.sh /srv/mento/backups/mento-YYYYMMDD-HHMMSS.sql.gz
   # Type YES when prompted
   ```

4. If you're restoring to a newer schema version than the backup, apply pending migrations:
   ```bash
   docker start mento-api-prod
   docker exec mento-api-prod sh -c \
     "DATABASE_URL=\$MIGRATIONS_DATABASE_URL \
      node node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma"
   ```

5. Restart the full stack and verify:
   ```bash
   docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod up -d
   curl https://api.mento.in/healthz
   # Expected: {"status":"ok"}
   ```

6. Check the User row count matches expectations:
   ```bash
   docker exec -e PGPASSWORD="<pw>" mento-postgres-prod \
     psql -U mento -d mento -c 'SELECT count(*) FROM "User";'
   ```

### Restore-on-a-fresh-server runbook

Use this when recovering onto a brand-new server (e.g., after catastrophic failure).

1. Provision the server and install Docker (see `docs/DEPLOY.md §1`).

2. Clone the repo:
   ```bash
   git clone https://github.com/<org>/mento.git /srv/mento
   cd /srv/mento
   cp .env.prod.example .env.prod
   nano .env.prod   # fill all secrets
   ```

3. Start only the Postgres container:
   ```bash
   docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod \
     up -d postgres
   # Wait until healthy
   docker ps   # State should show (healthy)
   ```

4. Copy the backup file to the new server (from your S3/R2 bucket or old server):
   ```bash
   # From R2 (if BACKUP_S3_BUCKET is configured):
   aws s3 cp \
     s3://<bucket>/postgres/mento-YYYYMMDD-HHMMSS.sql.gz \
     /srv/mento/backups/ \
     --endpoint-url https://<account>.r2.cloudflarestorage.com

   # Or via scp from a machine that has the file:
   scp user@old-server:/srv/mento/backups/mento-YYYYMMDD-HHMMSS.sql.gz \
     /srv/mento/backups/
   ```

5. Run the restore (Postgres container must be up; API not started yet):
   ```bash
   /srv/mento/scripts/restore-pg.sh -y \
     /srv/mento/backups/mento-YYYYMMDD-HHMMSS.sql.gz
   ```

6. Start the rest of the stack:
   ```bash
   docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod up -d
   ```

7. Apply any migrations that landed after the backup was taken:
   ```bash
   docker exec mento-api-prod sh -c \
     "DATABASE_URL=\$MIGRATIONS_DATABASE_URL \
      node node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma"
   ```

8. Install the backup cron (see above) and verify health.

### Monthly test-restore

**Recommendation**: perform a test restore into a throwaway container on the last Sunday of each month to confirm backups are valid and the restore procedure still works.

Quick procedure for a test restore (does NOT touch prod):

```bash
# 1. Spin up a separate Postgres container for testing
docker run --rm -d \
  --name mento-postgres-test \
  -e POSTGRES_USER=mento \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=mento \
  postgres:16-alpine

# Wait a few seconds for it to start, then restore
sleep 5
gunzip -c /srv/mento/backups/mento-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i -e PGPASSWORD=testpass mento-postgres-test \
      psql -U mento -d mento

# Check a row count
docker exec -e PGPASSWORD=testpass mento-postgres-test \
  psql -U mento -d mento -c 'SELECT count(*) FROM "User";'

# Tear down test container (data discarded automatically — --rm flag)
docker stop mento-postgres-test
```
