# Mento

> Anonymous, peer-led mentorship for UPSC aspirants. WhatsApp-simple. Built on the principle that the person who *almost* cleared carries the same wisdom as the person who did.

**Status:** MVP in active development. Phases 0-3 (foundation) + Phases A-D (spec alignment) shipped. See `docs/STATUS.md` for the live phase board.

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
│   └── docker-compose.local.yml   Postgres :5433 + Redis :6380
├── docs/
│   ├── Requirement.md             The product spec (source of truth)
│   ├── STATUS.md                  Live phase status — read this to know where we are
│   ├── ARCHITECTURE.md            Stack, decisions, why
│   └── RUNBOOK.md                 Common commands + troubleshooting
├── CLAUDE.md         Project-specific Claude Code instructions (always loaded)
├── AGENT.md          Sub-agent guidance + delegation patterns
├── SESSION.md        Current session checkpoint + how to resume
└── README.md         This file
```

## Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm + Turborepo | TS everywhere |
| API | NestJS + TS | Modular, scales to Phase-2 modules |
| ORM | Prisma | Type-safe DB access |
| DB | Postgres 16 | Relational + JSONB for flexible columns |
| Cache + pub-sub | Redis 7 | Socket.IO scaling + leaderboards later |
| Real-time chat | Self-built Socket.IO + Redis adapter | Owned data, zero per-MAU cost |
| Web | Next.js 15 (desktop only) | SEO, Server Components, mobile UA hard-redirected to `/get-app` |
| Mobile | Expo SDK 52 + Expo Router + NativeWind 4 | iOS + Android + Web target for laptop testing |
| Auth | Custom JWT (15m access + 30d refresh + rotation) + MSG91 OTP | India-first; Google OAuth pending (Phase J) |
| Anonymity | Display handles (`Aspirant_8421`) + letter avatars (B/A/P/M/I/F) + colored tiles + purple verification tick | Spec section 1.17 — no real names, no photos |
| Storage | Cloudflare R2 (S3-compat) | Zero egress; pending wiring (Phase F) |

## Architectural decisions locked

These are locked. Do not relitigate without explicit user request.

- **Stack path B**: keep NestJS + Next.js + Expo. No re-platform to FastAPI.
- **Self-built chat**: Socket.IO over Stream Chat.
- **Coordinator role**: schema in place, dashboard deferred to post-MVP.
- **Mobile policy**: web is desktop-only, mobile UA hard-redirected to `/get-app`. No mobile-responsive web.
- **Anonymity**: never expose phone or email in public responses. Always `displayHandle` + letter avatar.
- **Pricing**: tiered (FREE/BASIC/PRO/MAX). Placeholders ₹399/₹599/₹999 — validate during user testing.
- **1:1 sessions**: UI in MVP, real escrow defers to v1.1 (August).

## Quickstart

```bash
# 1. Install deps (root)
pnpm install

# 2. Copy env reference; defaults work for local dev (MSG91 mocked → OTP prints to api console)
cp .env.example .env

# 3. Start Postgres + Redis (non-default ports to avoid conflicts)
pnpm db:up

# 4. Push schema
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
6. As **Admin** (seed via `ADMIN_BOOTSTRAP_PHONE`): `/admin/users`, `/admin/assignments`, `/admin/audit`

## Docs to read next

- **`docs/STATUS.md`** — what's done, what's pending, by phase
- **`CLAUDE.md`** — how Claude Code should work in this repo (always loaded)
- **`SESSION.md`** — where the last session left off + restart commands
- **`docs/Requirement.md`** — the product spec (source of truth, never edit lightly)
