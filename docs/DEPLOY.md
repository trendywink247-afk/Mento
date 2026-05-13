# Mento — Production Deploy Guide

> See `docs/RUNBOOK.md` for day-to-day ops and troubleshooting.
> See `.env.prod.example` for every required environment variable.

---

## 1. Server provisioning

### Recommended specs (MVP / staging, ~10k MAU)
| Resource | Minimum | Comfortable |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Bandwidth | 1 Gbps shared | 1 Gbps dedicated |

AWS: `t3.medium` (2 vCPU, 4 GB). Hetzner: `CX32`. DigitalOcean: `s-2vcpu-4gb`.

### Required software

```bash
# Docker (official install script — Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out + back in

# Docker Compose v2 (bundled with Docker Desktop; verify on server)
docker compose version   # should print v2.x

# (Optional) Caddy standalone — not needed if using the caddy container
```

### DNS

Point the following A records to the server IP before first deploy:

| Hostname | Record |
|---|---|
| `mento.in` | A → server IP |
| `www.mento.in` | A → server IP |
| `api.mento.in` | A → server IP |

Caddy will provision TLS certificates automatically via Let's Encrypt once DNS resolves.

---

## Note on migration strategy

The project used `prisma db push` during local development (Phases A–G), which applies schema changes directly without generating migration files. Production deployments use `prisma migrate deploy`, which requires migration files in `apps/api/prisma/migrations/`.

**On the very first production deploy** (fresh database), use this workflow instead of `migrate deploy`:

```bash
# 1. Push the full current schema directly to the new prod DB
docker exec mento-api-prod \
  node node_modules/.bin/prisma db push \
    --schema prisma/schema.prisma \
    --accept-data-loss

# 2. Mark both existing migrations as already applied so migrate deploy
#    does not attempt to re-run them on subsequent deploys
docker exec mento-api-prod \
  node node_modules/.bin/prisma migrate resolve \
    --applied 20260510181133_init \
    --schema prisma/schema.prisma

docker exec mento-api-prod \
  node node_modules/.bin/prisma migrate resolve \
    --applied 20260513000000_catch_up_phases_a_through_g \
    --schema prisma/schema.prisma
```

**From Phase H onward**, all schema changes must go through `prisma migrate dev --create-only` locally, producing a migration file that gets committed and deployed via `prisma migrate deploy`. Never use `prisma db push` on production again.

---

## 2. First-time deploy

### 2a. Clone the repo

```bash
git clone https://github.com/<org>/mento.git /srv/mento
cd /srv/mento
```

### 2b. Prepare the environment file

```bash
cp .env.prod.example .env.prod
# Fill every variable. Required at minimum:
#   POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
#   NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL, ADMIN_BOOTSTRAP_PHONE
nano .env.prod
```

### 2c. Validate env vars before first deploy

Run the env checker **before** starting any containers. It hard-fails on missing
or weak secrets and warns about missing optional integrations:

```bash
./scripts/check-env.sh --file .env.prod
```

This must exit 0 before proceeding. Any `[FAIL]` line means a required secret is
absent or too short — fix `.env.prod` and re-run until the script prints `RESULT: PASS`.

Warnings (`[WARN]`) indicate optional integrations (Razorpay, Sentry, PostHog, etc.)
that are not wired up yet. They do not block deployment.

### 2d. Validate the compose file

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod config
# Must print the resolved YAML with no errors before continuing.
```

### 2e. Start all services

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod up -d
```

Boot order (enforced by healthcheck `depends_on`):
1. `postgres` + `redis` start and pass health checks.
2. `api` starts, runs, passes `/healthz`.
3. `web` starts, runs, passes `/`.
4. `caddy` starts last and begins serving traffic + provisioning TLS.

### 2f. Run database migrations

PgBouncer transaction-pool mode is **incompatible** with `prisma migrate deploy`.
Prisma's migration engine acquires session-level advisory locks, but in transaction
mode PgBouncer may route different statements to different server connections,
breaking the lock. Always run migrations directly against Postgres using
`MIGRATIONS_DATABASE_URL` (set in `.env.prod`):

```bash
# Apply all pending Prisma migrations via the direct Postgres connection.
# MIGRATIONS_DATABASE_URL bypasses PgBouncer (port 5432, not 6432).
docker exec mento-api-prod sh -c \
  "DATABASE_URL=\$MIGRATIONS_DATABASE_URL \
   node node_modules/.bin/prisma migrate deploy \
     --schema prisma/schema.prisma"
```

If `MIGRATIONS_DATABASE_URL` is not in scope inside the container you can
inject it explicitly:

```bash
docker exec -e DATABASE_URL="postgresql://mento:<pw>@postgres:5432/mento" \
  mento-api-prod \
  node node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
```

Never run `prisma migrate deploy` (or `prisma db push`) with a PgBouncer URL
(`port 6432` or `?pgbouncer=true`) — the migration will hang or silently corrupt
the `_prisma_migrations` table.

### 2g. Seed the admin user

```bash
# Requires ADMIN_BOOTSTRAP_PHONE to be set in .env.prod
docker exec mento-api-prod node dist/prisma/seed.js
```

### 2h. Verify

```bash
# API health
curl https://api.mento.in/healthz
# → {"status":"ok"}

# Web
curl -I https://mento.in
# → HTTP/2 200
```

---

## 3. Routine updates (tag-based)

The CI workflow (`.github/workflows/deploy.yml`) builds and pushes Docker images on every `v*` tag push.

```bash
# On your local machine
git tag v1.2.3
git push origin v1.2.3
```

The workflow builds `mento-api` and `mento-web` images, tags them `v1.2.3` + `latest`, and pushes to GHCR.

Once the SSH deploy step is enabled (see scaffold comments in `deploy.yml`), the server automatically pulls and restarts. Until then, deploy manually:

```bash
# On the server
cd /srv/mento
git pull --ff-only origin main

IMAGE_TAG=v1.2.3 \
  docker compose \
    -f infra/docker/docker-compose.prod.yml \
    --env-file .env.prod \
    pull

IMAGE_TAG=v1.2.3 \
  docker compose \
    -f infra/docker/docker-compose.prod.yml \
    --env-file .env.prod \
    up -d --remove-orphans

# Run any new migrations (via direct Postgres — NOT through PgBouncer)
docker exec mento-api-prod sh -c \
  "DATABASE_URL=\$MIGRATIONS_DATABASE_URL \
   node node_modules/.bin/prisma migrate deploy \
     --schema prisma/schema.prisma"

# Prune dangling images
docker image prune -f
```

---

## 4. Rollback

Pin the previous image tag in the compose `up` call:

```bash
IMAGE_TAG=v1.2.2 \
  docker compose \
    -f infra/docker/docker-compose.prod.yml \
    --env-file .env.prod \
    up -d
```

No schema rollback is needed unless the migration was destructive. If you need to roll back a migration, restore from the pre-migration backup (see §5) and apply only the migrations up to the previous version.

---

## 2i. Install backup scripts and cron

```bash
# Make the scripts executable (already committed as +x; double-check on server)
chmod +x /srv/mento/scripts/backup-pg.sh
chmod +x /srv/mento/scripts/restore-pg.sh

# Create the local backup directory
mkdir -p /srv/mento/backups

# Install the daily cron job (runs at 02:00 UTC as root)
cat > /etc/cron.d/mento-backup <<'EOF'
0 2 * * * root /srv/mento/scripts/backup-pg.sh >> /var/log/mento-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/mento-backup

# Test the backup script immediately (must complete without errors)
/srv/mento/scripts/backup-pg.sh
ls -lh /srv/mento/backups/
```

### R2 / S3 remote backup (optional but strongly recommended)

Decide on a backup bucket before first deploy. You can reuse the verification-doc R2 bucket credentials or create a dedicated bucket.

In `.env.prod`, set:

```
BACKUP_S3_BUCKET=mento-pg-backups         # R2 bucket name
BACKUP_S3_REGION=auto                      # "auto" for R2; use "us-east-1" for AWS
AWS_ACCESS_KEY_ID=<r2-api-key-id>          # Can reuse AWS_ACCESS_KEY_ID if same creds
AWS_SECRET_ACCESS_KEY=<r2-api-key-secret>  # Same
AWS_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
```

If `BACKUP_S3_BUCKET` is left empty, the script skips the upload step and keeps only local copies.

After setting these, verify upload works:

```bash
/srv/mento/scripts/backup-pg.sh
# Should print: Upload OK: s3://mento-pg-backups/postgres/mento-....sql.gz
```

---

## 5. Backups

Backups are handled by `scripts/backup-pg.sh`. See the full runbook (restore procedure, fresh-server recovery, monthly test-restore) in **[docs/RUNBOOK.md §Backups](./RUNBOOK.md#backups)**.

Quick reference:

| Task | Command |
|---|---|
| Run manual backup | `/srv/mento/scripts/backup-pg.sh` |
| List local backups | `ls -lh /srv/mento/backups/` |
| Restore from backup | `/srv/mento/scripts/restore-pg.sh <file.sql.gz>` |
| Non-interactive restore | `/srv/mento/scripts/restore-pg.sh -y <file.sql.gz>` |

Backups are written to `/srv/mento/backups/mento-YYYYMMDD-HHMMSS.sql.gz` and pruned after 7 days. Remote copies go to `s3://$BACKUP_S3_BUCKET/postgres/` when configured.

---

## 6. Checking logs

```bash
# All services
docker compose -f infra/docker/docker-compose.prod.yml logs -f

# Single service
docker compose -f infra/docker/docker-compose.prod.yml logs -f api
docker compose -f infra/docker/docker-compose.prod.yml logs -f web
docker compose -f infra/docker/docker-compose.prod.yml logs -f caddy
```

---

## 7. TLS / Caddy

Caddy manages TLS automatically. Certificates are stored in the `mento_caddy_data` named volume and renewed automatically before expiry.

If a certificate fails to provision (check `docker logs mento-caddy-prod`):
- Confirm DNS is resolving correctly: `dig mento.in @1.1.1.1`.
- Confirm ports 80 and 443 are open in the firewall.
- Caddy retries automatically; no manual intervention is usually needed.

---

## 8. Firewall rules (UFW example)

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy redirects to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw allow 443/udp   # HTTP/3 (QUIC) — optional
ufw enable
```

All internal ports (5432, 6379, 4000, 3000) must remain closed to the internet. They are only reachable within the `mento_internal` Docker network.

---

## 9. Mobile builds (EAS)

Mento's iOS and Android apps are built via **Expo Application Services (EAS)**. You do not need Xcode or Android Studio on the build machine — EAS builds remotely.

Config file: `apps/mobile/eas.json`  
App metadata: `apps/mobile/app.json`  
Store copy: `apps/mobile/STORE.md`  
Screenshot spec: `apps/mobile/store-screenshots/README.md`

### 9a. One-time EAS account setup

1. Create a free Expo account at https://expo.dev if you don't have one.
2. Install the EAS CLI (no global install required — use `pnpm dlx`):

```bash
pnpm dlx eas-cli --version   # verify it works
```

3. Log in:

```bash
pnpm dlx eas-cli login
# Enter your Expo username + password
```

4. Link the project to EAS and get a real project ID:

```bash
cd /root/Mento/apps/mobile
pnpm dlx eas-cli init
# Follow prompts. This writes the real projectId into app.json automatically.
```

5. After `eas init` completes, update `EXPO_PUBLIC_EAS_PROJECT_ID` in `.env` to match:

```bash
# In /root/Mento/.env (and .env.prod):
EXPO_PUBLIC_EAS_PROJECT_ID=<the-uuid-eas-init-printed>
```

Also update `apps/mobile/app.json` → `expo.extra.eas.projectId` with the same UUID.

6. Update `expo.owner` in `app.json` from `"mento"` to your actual Expo account slug.

### 9b. Required secrets (add via EAS dashboard or CLI)

| Secret | Where to get it |
|---|---|
| Apple App Store Connect API key (P8 file + Key ID + Issuer ID) | App Store Connect → Users & Access → Integrations → App Store Connect API |
| Apple Developer Team ID | developer.apple.com → Membership |
| App Store Connect App ID (numeric) | App Store Connect → My Apps → App Information |
| Google Play service account JSON | Google Play Console → Setup → API access → Service accounts |

Add secrets to EAS:

```bash
pnpm dlx eas-cli secret:create --scope project --name APPLE_API_KEY_P8 --value "$(cat AuthKey_XXXXXXXXXX.p8)"
```

Or upload them in the EAS dashboard at https://expo.dev/accounts/<org>/projects/mento/secrets.

Also fill in the TODO placeholders in `apps/mobile/eas.json` → `submit.production.ios`:
- `ascAppId` — numeric App Store Connect App ID
- `appleId` — Apple ID email for App Store Connect
- `appleTeamId` — 10-character Apple Developer Team ID

### 9c. First preview build (smoke test — no store submission)

```bash
cd /root/Mento/apps/mobile
pnpm dlx eas-cli build --profile preview --platform android
```

This produces a `.apk` you can install directly on a physical Android device or share via the EAS dashboard. Good for QA before going to store.

For iOS preview (requires Apple provisioning — easier to start with Android):

```bash
pnpm dlx eas-cli build --profile preview --platform ios
```

### 9d. Production store builds

```bash
# Build for both platforms (queues two EAS build jobs)
pnpm dlx eas-cli build --profile production --platform all
```

Monitor build progress at https://expo.dev/accounts/<org>/projects/mento/builds or in the terminal output.

Build outputs:
- iOS: `.ipa` file (automatically signed)
- Android: `.aab` (Android App Bundle — required for Play Store)

### 9e. Submit to stores

After a production build succeeds, submit it:

```bash
# Submit iOS to TestFlight / App Store
pnpm dlx eas-cli submit --profile production --platform ios

# Submit Android to Play Store internal track
pnpm dlx eas-cli submit --profile production --platform android
```

For Android, place the Google service account JSON at `apps/mobile/google-service-account.json` (gitignored — never commit this file).

### 9f. OTA (over-the-air) updates via EAS Update

OTA updates let you ship JS/asset changes without a full store build. They respect `runtimeVersion.policy: "appVersion"` — an OTA update for `0.1.0` only reaches devices running `0.1.0`.

```bash
# Push an OTA update to the preview channel
pnpm dlx eas-cli update --channel preview --message "Fix chat timestamp display"

# Push to production channel (reaches all production users)
pnpm dlx eas-cli update --channel production --message "Patch journal sync edge case"
```

Use OTA for: JS bug fixes, copy changes, minor UI tweaks.
Use a full store build for: native module changes, new permissions, SDK upgrades.

### 9g. Development builds (on-device debugging)

```bash
# Build a dev client for iOS simulator
pnpm dlx eas-cli build --profile development --platform ios

# Build a dev APK for Android (install directly)
pnpm dlx eas-cli build --profile development --platform android
```

Then start the local dev server:

```bash
cd /root/Mento && pnpm --filter @mento/mobile dev
```

The dev client will connect to your local Expo server instead of loading a bundled app.

### 9h. Notification icon

Before the first build, create `apps/mobile/assets/notification-icon.png`:
- 96 × 96 px
- White icon on transparent background (Android requirement)
- Simple silhouette of the Mento mark — no text at this size

This path is referenced in `app.json` → `expo.notification.icon`.
