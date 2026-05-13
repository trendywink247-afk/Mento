# Mento

> Anonymous, peer-led mentorship for UPSC aspirants. WhatsApp-simple. Built on the principle that the person who *almost* cleared carries the same wisdom as the person who did.

**Status:** MVP scope shipped end-to-end (53 commits). Phases 0-3 (foundation) + A-D (spec alignment) + E (payments) + G (moderation) + H (sessions) + J (Google OAuth) + L (chat polish) live. See `docs/STATUS.md` for the full phase board and `docs/CHANGELOG.md` for the wave-by-wave history.

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
├── docs/
│   ├── Requirement.md             Product spec (source of truth)
│   ├── STATUS.md                  Live phase status — read this to know where we are
│   ├── CHANGELOG.md               Reverse-chronological commit/wave history
│   ├── ARCHITECTURE.md            Stack decisions
│   ├── DEPLOY.md                  Production deploy guide
│   ├── RUNBOOK.md                 Common commands + troubleshooting
│   └── REVIEW*.md                 Wave reviewer findings
├── CLAUDE.md         Project-specific Claude Code instructions (always loaded)
├── AGENT.md          Sub-agent guidance + Wave conventions
├── SESSION.md        Current session checkpoint + how to resume
└── README.md         This file
```

## Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm + Turborepo | TS everywhere |
| API | NestJS + TS | Modular, scales to Phase-2 modules |
| ORM | Prisma | Type-safe DB access |
| DB | Postgres 16 | Relational + JSONB |
| Cache + pub-sub | Redis 7 | Socket.IO scaling + leaderboards later |
| Real-time chat | Self-built Socket.IO + Redis adapter | Owned data, zero per-MAU cost |
| Web | Next.js 15 (desktop only) | SEO; mobile UA hard-redirected to `/get-app` |
| Mobile | Expo SDK 52 + Expo Router + NativeWind 4 | iOS + Android |
| Auth | Custom JWT (15m + 30d refresh + rotation) + MSG91 OTP + Google OAuth | India-first |
| Payments | Razorpay (HMAC-SHA256 webhook) | Tiered: FREE/BASIC/PRO/MAX |
| Push | Expo Push (batched 100/req) | Offline message + chat request alerts |
| Storage | Cloudflare R2 (S3-compat) | Wiring pending in Phase F |
| Observability | PostHog + Sentry (web/api/mobile) | Source map upload via CI |
| Anonymity | Display handles (`Aspirant_8421`) + letter avatars (B/A/P/M/I/F) + colored tiles + purple verification tick | Spec section 1.17 |

## Architectural decisions locked

These are locked. Do not relitigate without explicit user request.

- **Stack path B**: keep NestJS + Next.js + Expo. No re-platform to FastAPI.
- **Self-built chat**: Socket.IO over Stream Chat.
- **Coordinator role**: schema in place, dashboard deferred to post-MVP.
- **Mobile policy**: web is desktop-only, mobile UA hard-redirected to `/get-app`.
- **Anonymity**: never expose phone or email in public responses.
- **Pricing**: tiered (FREE/BASIC/PRO/MAX). Placeholders ₹399/₹599/₹999 — validate during user testing.
- **1:1 sessions**: UI in MVP, real escrow defers to v1.1 (August).
- **Aadhaar**: hash-only is the only Aadhaar form ever stored.

## Quickstart

```bash
# 1. Install deps (root)
pnpm install

# 2. Copy env reference; defaults work for local dev (MSG91 mocked → OTP prints to api console)
cp .env.example .env

# 3. Start Postgres + Redis (non-default ports to avoid conflicts)
pnpm db:up

# 4. Push schema (dev only; prod uses migrations — see docs/DEPLOY.md)
cd apps/api && pnpm prisma db push --accept-data-loss
cd ../..

# 5. Run all three apps via turbo
pnpm dev
```

URLs:
- API:    http://localhost:4000
- Web:    http://localhost:3030
- Expo:   http://localhost:8081 (press `w` for browser mobile-view)

## Demo flow (after `pnpm dev`)

1. http://localhost:3030 → "Get started" → pre-auth role pick
2. Pick **Aspirant** → timed welcome flash → `/login?role=ASPIRANT` → phone OTP (code prints in api console)
3. After verify → routes to `/onboarding/mirror` → 7-step Mirror wizard → `/dashboard`
4. Browse `/mentors` → click a mentor → "Initiate connection" → 160-char intro
5. Open `/journals` → pick a category → write entries
6. Visit `/upgrade` → upgrade to PRO (dev mode uses simulate-success; no Razorpay key needed)
7. As **Admin** (seed via `ADMIN_BOOTSTRAP_PHONE` then OTP-verify + `pnpm --filter @mento/api db:seed`):
   - `/admin/users`, `/admin/assignments`, `/admin/audit`, `/admin/moderation`

## Status

The live phase board lives at **[docs/STATUS.md](docs/STATUS.md)**.
Reverse-chronological commit/wave history at **[docs/CHANGELOG.md](docs/CHANGELOG.md)**.

## Test

```bash
# Unit tests (Vitest, 115 passing)
cd apps/api && pnpm test

# API + browser e2e (Playwright)
#   Spin up the dev stack (db + api + web) then run:
cd apps/web && pnpm test:e2e

# Splits:
#   apps/web/e2e/api/        REST contract specs (34/40 pass; 6 require admin-seed)
#   apps/web/e2e/*.spec.ts   Browser specs + axe-playwright a11y (61 pass / 5 skip)
```

Production web build: `cd apps/web && pnpm build` — green as of latest commit.

## Deploy

Production deploy is fully scaffolded. See **[docs/DEPLOY.md](docs/DEPLOY.md)** for the first-deploy baseline workflow (uses `prisma migrate resolve` to mark the init + catch-up migrations applied) and ongoing `migrate deploy` flow. Infra files:

- `infra/docker/docker-compose.prod.yml`
- `infra/docker/Caddyfile`
- `infra/docker/Dockerfile.{api,web}`

GitHub Actions CI builds + uploads sourcemaps to Sentry. See `.github/workflows/`.

## Docs to read next

- **`docs/STATUS.md`** — what's done, what's pending, commit SHAs
- **`docs/CHANGELOG.md`** — wave-by-wave history
- **`SESSION.md`** — where the last session left off + restart commands
- **`CLAUDE.md`** — how Claude Code should work in this repo (always loaded)
- **`AGENT.md`** — subagent dispatch + Wave conventions
- **`docs/Requirement.md`** — the product spec (source of truth, never edit lightly)
- **`docs/DEPLOY.md`** — production deploy guide
