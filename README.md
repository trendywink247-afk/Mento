# Mento

> Anonymous, peer-led mentorship for UPSC aspirants. WhatsApp-simple. Built on the principle that the person who *almost* cleared carries the same wisdom as the person who did.

**Status:** MVP feature-complete. 13 waves shipped across 53+ commits. Phases 0-3 (foundation) + A-L (spec alignment, payments, moderation, sessions, analytics, polish) live. See `docs/STATUS.md` for the full phase board and `docs/CHANGELOG.md` for the wave-by-wave history.

---

## What you have on disk

```
/root/Mento
├── apps/
│   ├── api/         NestJS + Prisma + Socket.IO + Redis (port 4000)
│   ├── web/         Next.js 15 (App Router) — desktop only (port 3030)
│   └── mobile/      Expo SDK 52 + Expo Router + NativeWind (Expo dev :8081)
├── packages/
│   ├── types/       Shared TS types (Role, AvatarLetter, ConversationSummary, …)
│   ├── api-client/  Typed REST + Socket.IO wrapper (ky + socket.io-client)
│   ├── validation/  Zod schemas (phone, OTP, profile, message, etc.)
│   ├── hooks/       Shared React hooks
│   └── config/      Base tsconfig + prettier
├── infra/docker/
│   ├── docker-compose.local.yml   Postgres :5433 + Redis :6380
│   ├── docker-compose.prod.yml    caddy + api + web + postgres + redis
│   ├── Caddyfile                  TLS reverse proxy for mento.in + api.mento.in
│   └── Dockerfile.{api,web}       3-stage prod builds
├── loadtest/        k6 load tests + scaling playbook
├── docs/
│   ├── Requirement.md             Product spec (source of truth)
│   ├── STATUS.md                  Live phase status
│   ├── CHANGELOG.md               Reverse-chronological wave history
│   ├── ARCHITECTURE.md            Stack decisions
│   ├── DEPLOY.md                  Production deploy guide
│   ├── RUNBOOK.md                 Common commands + troubleshooting
│   ├── RELEASE_READINESS.md       Go/no-go audit (15 categories)
│   └── FOUNDER.md                 Investor-ready one-pager
├── CLAUDE.md         Project-specific Claude Code instructions
├── AGENT.md          Sub-agent guidance + Wave conventions
└── SESSION.md        Current session checkpoint + how to resume
```

## Stack at a glance

| Layer | Choice |
|---|---|
| Monorepo | pnpm + Turborepo |
| API | NestJS + TypeScript |
| ORM | Prisma |
| DB | Postgres 16 |
| Cache + pub-sub | Redis 7 |
| Real-time chat | Self-built Socket.IO + Redis adapter |
| Web | Next.js 15 (desktop only; mobile UA hard-redirected to `/get-app`) |
| Mobile | Expo SDK 52 + Expo Router + NativeWind 4 |
| Auth | Custom JWT (15m + 30d refresh + rotation) + MSG91 OTP + Google OAuth |
| Payments | Razorpay (HMAC-SHA256 webhook) — tiers: FREE / BASIC / PRO / MAX |
| Push | Expo Push (batched 100/req) |
| Storage | Cloudflare R2 (S3-compat, wiring pending Phase F) |
| Analytics | PostHog (explicit events only; no autocapture) |
| Observability | Sentry (web + api + mobile, source maps via CI) |
| Reverse proxy | Caddy (auto-TLS, HSTS, gzip+zstd) |
| Mobile builds | EAS build pipeline + OTA updates via EAS Update |
| Anonymity | Display handles (`Aspirant_8421`) + letter avatars + purple verification tick |

## Quickstart

```bash
# 1. Install deps
pnpm install

# 2. Copy env reference (MSG91 mocked in dev — OTP prints to api console)
cp .env.example .env

# 3. Start Postgres :5433 + Redis :6380
pnpm db:up

# 4. Push schema (dev only; prod uses migrate deploy — see docs/DEPLOY.md)
cd apps/api && pnpm prisma db push --accept-data-loss
cd ../..

# 5. Run all three apps
pnpm dev
```

URLs:
- API: http://localhost:4000
- Web: http://localhost:3030
- Expo: http://localhost:8081 (press `w` for browser mobile-view)

## Demo flow

1. Go to http://localhost:3030 — "Get started" — pre-auth role pick
2. Pick **Aspirant** — timed welcome flash — `/login?role=ASPIRANT` — phone OTP (code prints in api console)
3. After OTP verify — routes to `/onboarding/mirror` — 7-step Mirror wizard — `/dashboard`
4. Browse `/mentors` — click a mentor — "Initiate connection" — 160-char intro
5. Open `/journals` — pick a category — write entries
6. Visit `/upgrade` — upgrade to PRO (dev mode: simulate-success, no Razorpay key needed)
7. As **Admin** (seed via `ADMIN_BOOTSTRAP_PHONE` then OTP-verify + `pnpm --filter @mento/api db:seed`):
   - `/admin/analytics` (funnel + daily signups + daily messages)
   - `/admin/flags` (server-driven feature flags)
   - `/admin/invites` (beta invite codes)
   - `/admin/moderation` (report queue + suspend/ban)

## Test

```bash
# Unit tests — Vitest, 115 passing (anonymity, auth, moderation, subscriptions, sessions)
cd apps/api && pnpm test

# API e2e — Playwright API project (34/40 pass; 6 require admin-seed promotion)
cd apps/web && pnpm test:e2e --project=api

# Browser e2e — Playwright desktop-chromium, includes axe-playwright a11y
cd apps/web && pnpm test:e2e --project=chromium

# Load tests — k6 (smoke: 50 VUs; full mixed: 500 VUs)
k6 run loadtest/k6/01-onboarding.js
# or: pnpm loadtest  (Docker, no local k6 install needed)
```

## Deploy

Production deploy is fully scaffolded. See **[docs/DEPLOY.md](docs/DEPLOY.md)** for:
- First-deploy workflow (`db push` + `migrate resolve` baseline, then `migrate deploy` for updates)
- Tag-based CI/CD with Docker images pushed to GHCR
- Rollback procedure
- Backup (pg_dump cron + rclone to R2)
- EAS mobile build pipeline (§9)

Infra files: `infra/docker/docker-compose.prod.yml`, `infra/docker/Caddyfile`, `infra/docker/Dockerfile.{api,web}`

GitHub Actions CI: `.github/workflows/` — builds + uploads Sentry sourcemaps on `v*` tags.

## Docs

| Doc | Purpose |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | Phase board — what's done, what's pending |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Wave-by-wave history |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Production deploy + EAS mobile builds |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Day-to-day ops + troubleshooting |
| [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md) | Go/no-go audit across 15 categories |
| [docs/FOUNDER.md](docs/FOUNDER.md) | Investor-ready product one-pager |
| [docs/Requirement.md](docs/Requirement.md) | Product spec (source of truth) |
| [SESSION.md](SESSION.md) | Last session checkpoint + restart commands |
| [CLAUDE.md](CLAUDE.md) | Claude Code instructions for this repo |
