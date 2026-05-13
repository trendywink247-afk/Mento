# Mento — Claude Code Project Instructions

> This file is automatically loaded into Claude's context for every interaction in this repo. Keep it terse and load-bearing.

## What this project is

Anonymous, peer-led UPSC mentorship platform. **Three roles**: Admin (web only), Mentor, Aspirant. (Coordinator role exists in schema but dashboard is post-MVP.) Spec at `docs/Requirement.md` is the source of truth — always read it before proposing product changes.

## Locked architectural decisions

Do NOT relitigate these without an explicit ask. They were decided in earlier sessions:

- **Stack path B**: NestJS + Prisma + Next.js + Expo. No re-platform.
- **Self-built Socket.IO chat** (not Stream).
- **Web is desktop-only** (≥1024px). Mobile UA hard-redirected to `/get-app`. No responsive web.
- **Anonymity is non-negotiable**: never expose `phone`/`email` in public responses. Always return `displayHandle` + `avatarLetter` + `avatarColor` + `hasPurpleTick`.
- **No star ratings on humans**: positive written reviews only. Copy bank includes "We don't appreciate rating humans."
- **Coordinator role**: schema in place, dashboard deferred to post-MVP.
- **Pricing tiers**: FREE / BASIC / PRO / MAX (₹399 / ₹599 / ₹999 placeholders). Validate during user testing.
- **1:1 sessions**: UI ships in MVP, real escrow defers to v1.1 (August).

## Repo layout

```
apps/{api,web,mobile}     # NestJS, Next.js 15, Expo SDK 52
packages/{types,api-client,validation,hooks,config}
infra/docker/             # local docker-compose
docs/                     # spec, status, runbook
prisma migrations live in apps/api/prisma/migrations
```

## Phase status (live)

Read `docs/STATUS.md` for the up-to-date phase board. As of last commit (53 commits on `main`):

- ✅ Phases 0-3 (bootstrap, auth, chat, admin)
- ✅ Phase A (spec-aligned schema + anonymity layer)
- ✅ Phase B (pre-auth role pick + 12-screen Mirror + mentor onboarding)
- ✅ Phase C (mentor discovery + 160-char chat request)
- ✅ Phase D (journals with presence-gated sharing + audit log)
- ✅ Phase E (Razorpay tiers + paywall)
- ✅ Phase G (moderation: report queue + suspend/ban + Aadhaar denylist)
- ✅ Phase H (1:1 booking UI + simulated escrow)
- ✅ Phase J (Google OAuth + PostHog + Sentry)
- ✅ Phase L (chat→journal + WhatsApp archive tabs + My Mentees, partial)
- ✅ Push notifications (Expo Push)
- ✅ Production infra (Dockerfiles, Caddyfile, compose, CI sourcemaps)
- ✅ Test coverage (115 Vitest unit, 34/40 API e2e, 61/66 browser e2e)
- ⏳ Phase F (mentor verification + R2 upload) — deferred, admin promotes manually
- ⏳ Phase K (broadcast request) — spec defers to v1.1
- ⏳ Coordinator dashboard — post-MVP
- ⏳ Real Razorpay escrow — v1.1 (August)

## Conventions

### TypeScript / NestJS
- ES module imports use the bundler resolution everywhere except NestJS (`apps/api`), which uses CommonJS — **do NOT add `.js` extensions in api imports**.
- Validation: `class-validator` DTOs on NestJS routes + Zod schemas in `packages/validation`. Both, for defense in depth.
- `req.user` shape is `JwtUser` (`sub`, `role`, `jti`). Use `@CurrentUser()` decorator.
- Public routes use `@Public()`. RBAC uses `@Roles(Role.X)` — both global guards run via `APP_GUARD`.
- Prisma client is global (via `PrismaModule` with `@Global()`).
- Letter avatar logic: never compute it inline. Use `apps/api/src/common/anonymity.ts`.

### React / Next.js / Expo
- Display handles, not names. Component: `LetterAvatar` (web + mobile). Never show phone/email in public UI.
- Copy: use strings from `apps/{web,mobile}/lib/copy.ts` (lifted verbatim from spec). Don't write fresh copy unless the spec doesn't cover it.
- Auth state: Zustand store in `lib/auth-store.ts`. Persisted to localStorage (web) / SecureStore (mobile).
- API client: `getApiClient()` from `lib/api.ts`. Typed via `@mento/api-client`.
- Onboarding gating: post-OTP, call `/onboarding/state` and route by `nextStep`.

### Database
- Postgres 16 on `localhost:5433` (not 5432 — port conflict with GeekSpace2.0).
- Redis 7 on `localhost:6380`.
- Schema in `apps/api/prisma/schema.prisma`. After edits run `cd apps/api && pnpm prisma db push --accept-data-loss` for dev or proper migrate for prod.
- Prod baseline migration is `20260510181133_init` + catch-up `20260513000000_catch_up_phases_a_through_g`. First prod deploy uses `prisma migrate resolve` to mark them applied — see `docs/DEPLOY.md`.

### Payments / paywall
- Tier paywall lives at `/upgrade`. Dev mode (no `NEXT_PUBLIC_RAZORPAY_KEY_ID`) uses `simulate-success` directly — no checkout roundtrip.
- `@MinTier(PRO)` is applied to PRO-gated routes (e.g. `POST /journals/save-from-chat`). `TierGuard` is a global `APP_GUARD`.
- `mento:tier-changed` custom event lets the sidebar tier badge update without a hard refresh.

### Moderation
- Moderation actions: `DISMISS` / `WARN` / `SUSPEND` / `BAN`. All write a `ModerationActionLog` row and the user audit log.
- BAN writes the Aadhaar **hash** to `MentorDenylist`. Aadhaar hash is the only Aadhaar form ever stored.
- SUSPEND/BAN revokes refresh tokens + deletes push tokens. Banned users are rejected at OTP-verify and Google sign-in.

### Testing
- Run Vitest before commits: `cd apps/api && pnpm test` (115 unit tests).
- Run e2e against live stack: spin up `pnpm dev`, then `cd apps/web && pnpm test:e2e`.
- 6 API e2e tests require admin promotion via `pnpm --filter @mento/api db:seed` after OTP-verify creates the user.

## Sandbox quirks (read carefully)

- **Shell cwd resets** to `/root/GeekSpace2.0` between Bash invocations even though `/root/Mento` is the project root. Always prepend `cd /root/Mento` (or use absolute paths / `git -C /root/Mento`). The post-command system reminder says "Shell cwd was reset to /root/Mento" but the NEXT command still starts in GeekSpace2.0 — don't trust that reminder.
- `pnpm typecheck` from the root may run GeekSpace2.0 — always `cd /root/Mento/apps/<app> && pnpm typecheck`.
- Docker port 6379, 3000, 3001, 5432 are taken by GeekSpace2.0 containers. We use 6380, 3030, 5433 instead.

## Common commands

```bash
# Start local infra
docker compose -f /root/Mento/infra/docker/docker-compose.local.yml up -d

# Apply schema changes after editing schema.prisma
cd /root/Mento/apps/api && pnpm prisma db push --accept-data-loss

# Typecheck individual apps (always cd first)
cd /root/Mento/apps/api && pnpm typecheck
cd /root/Mento/apps/web && pnpm typecheck
cd /root/Mento/apps/mobile && pnpm typecheck

# Run all dev servers
cd /root/Mento && pnpm dev

# Test auth end-to-end via curl
curl -s -X POST http://localhost:4000/auth/otp/request -H 'Content-Type: application/json' -d '{"phone":"+919876543210"}'
# Returns devCode in dev mode
```

## When working on this repo

1. **Read `docs/STATUS.md` first** to know where we are.
2. **Read the spec section relevant to your task** in `docs/Requirement.md`.
3. **Run typecheck per-app after every batch** — don't trust root-level `pnpm typecheck` because of the cwd reset issue.
4. **Commit per slice** with `Phase X: <description>` style messages so history stays scannable.
5. **Never invent copy**. Pull from `lib/copy.ts` or the appendix in `docs/Requirement.md`.
6. **Never break anonymity**. If you find yourself returning `phone` or `email` to a non-admin route, stop.
7. **Letter avatars everywhere a user appears**. No initials of display handle. Use the `LetterAvatar` component.

## When to use subagents

See `AGENT.md` for delegation patterns. TL;DR: parallelize independent slices (e.g., backend module + frontend page) with `coder` / `backend` / `frontend` agents. Use `Explore` for codebase questions across many files. Use `reviewer` after any meaningful change.

## Don't

- Add real names or photos anywhere.
- Add star ratings on humans.
- Re-platform the backend (FastAPI was considered and rejected).
- Make Next.js responsive — mobile UA must hard-redirect.
- Rewrite copy that the spec already provides.
- Run destructive git commands (force push, reset --hard) without explicit user request.
- Commit secrets. `.env` is gitignored. `.env.example` is the reference.

## Useful internal references

- Anonymity helper: `apps/api/src/common/anonymity.ts`
- Letter avatar component: `apps/{web,mobile}/components/LetterAvatar.tsx`
- Copy bank: `apps/{web,mobile}/lib/copy.ts`
- Auth gating (mobile): `apps/mobile/app/_layout.tsx`
- Onboarding state machine: `apps/api/src/modules/onboarding/onboarding.service.ts`
- Spec: `docs/Requirement.md`
- Plan file: `/root/.claude/plans/eventual-nibbling-token.md`
