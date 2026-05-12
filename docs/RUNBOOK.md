# Mento — Runbook

> Common commands + troubleshooting. Bookmarks for things you'll forget.

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
| Web | http://localhost:3030 |
| Expo dev server | http://localhost:8081 |
| Expo Web | http://localhost:8081 (press `w`) |
| Postgres | localhost:5433, user `mento`, password `mento`, db `mento` |
| Redis | localhost:6380 |

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

## Backup local DB

```bash
docker exec mento-postgres-local pg_dump -U mento mento | gzip > mento-$(date +%Y%m%d).sql.gz
```

## Restore local DB

```bash
gunzip -c mento-YYYYMMDD.sql.gz | docker exec -i mento-postgres-local psql -U mento -d mento
```
