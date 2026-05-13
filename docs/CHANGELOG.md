# Mento — Changelog

> Reverse-chronological commit history grouped by Wave/Phase. Each entry has the short SHA + a one-line summary. For the live phase board see `docs/STATUS.md`. Last updated 2026-05-13.

## Wave 13 — EAS mobile + PostHog taxonomy + Wave 12 fixes (2026-05-13)

- `da593bc` fix: Wave 12 reviewer criticals — `@nestjs/schedule` dep in `apps/api/package.json`, robots.txt switched from Next route-group names to real URL prefixes
- `4c62d52` analytics: wire PostHog capture() across the full onboarding + conversion funnel (40 events, 39 web + 26 mobile + 5 server-side; UUID-only identify, never PII in props; full taxonomy in `docs/ANALYTICS_EVENTS.md`)
- `7bd6a9f` mobile-build: EAS pipeline (development/preview/production profiles), app.json spec alignment, `apps/mobile/STORE.md`, `store-screenshots/README.md` capture spec

## Wave 12 — Nudges + hygiene + perf + SEO + Wave 11 fixes (2026-05-13)

- `f146c44` fix: Wave 11 reviewer criticals — register `AnalyticsModule` + `FlagsModule` in `AppModule`, race-safe invite redemption via atomic `UPDATE ... WHERE uses < maxUses` SQL, api-client response types corrected
- `d76b0b5` seo: `sitemap.ts`, `robots.ts`, per-route `opengraph-image.tsx` for `/`, `/pricing`, `/get-app`, `/(legal)/privacy`, metadata + JSON-LD on landing
- `24a9e3e` perf: partial indexes on `User.createdAt` and `Message.createdAt` (`WHERE deletedAt IS NULL`), Socket.IO Redis adapter audited (`SOCKET_REDIS_ADAPTER` gate), `mentors:list` 30s Redis cache with invalidation on approve/reject/ban
- `30da2e1` chore: drop unused imports + dead `this.redis` field in `auth.service.ts`, fix `SkeletonRow` shimmer (now reads `opacity.value`), Sentry token via BuildKit `--mount=type=secret`, `caddy fmt`
- `7b38155` growth: onboarding nudges — `@nestjs/schedule` crons (`0 */6 * * *` mirror, `0 */12 * * *` mentor), 7-day dedup via `OnboardingEvent` rows, 500-row cap, anonymity-clean push bodies, `POST /admin/nudges/trigger` for admins

## Wave 11 — Admin analytics + feature flags + beta invites (2026-05-13)

- `6c69e44` fix: wire `api-client` for analytics/flags pages + add `ANALYTICS_COPY` strings
- `fd6a7f2` invites: beta invite-code system — `InviteCode` + `InviteRedemption` tables, admin `/admin/invites` UI, redeem-on-signup gating via `BETA_INVITE_REQUIRED`, fix unescaped quote in `/admin/flags`
- `889f839` flags: server-driven feature-flag system — schema (`FeatureFlag`), public `/flags` + admin `/admin/flags` API, web + mobile `FeatureFlagsProvider` with 60s poll + 30s Redis cache, `useFeatureFlag()` hook, `POST /admin/flags/seed` for defaults
- `27e2c2c` analytics: founder-facing `/admin/analytics` dashboard — DAU/MAU, signup funnel, MRR, conversion, mentor verification counts, 60s Redis cache

## Wave 9/10 — DB enum sync + e2e validation (2026-05-13)

- `09b5dea` docs: add FINAL_VALIDATION report — Wave 9 post-merge verification (40 API + 66 browser e2e all green; Docker API image builds at 433 MB in ~60 s)
- `36ad73c` fix: Dockerfile.api missing `.npmrc` copy + fix MOD-UI-3 fragile `'500'` assertion (now checks `_next/static/chunks/fallback/` instead)
- `e973fb8` fix: Wave 9 blockers — DB enum sync (`DISMISS`, `SUSPEND_ASPIRANT`, `SUSPEND_MENTOR` added via `prisma db push`), mobile `load()` Promise return, `.npmrc` + `.dockerignore`, `@tailwindcss/typography` installed for legal prose
- `451f694` fix: Wave 8 release blockers — env var rename (`NEXT_PUBLIC_API_URL` → `NEXT_PUBLIC_API_BASE_URL`), missing infra vars (`RAZORPAY_PLAN_*`, `EXPO_ACCESS_TOKEN`, `SOCKET_REDIS_ADAPTER`), legal pages (`/privacy`, `/terms`, `/refund-policy`)

## Wave 8 — Doc sync + k6 load test scaffolding (2026-05-13)

- `b1e65cf` loadtest: k6 load-test suite (onboarding, mentor discovery, chat history) + `loadtest/SCALING_PLAYBOOK.md`
- `0cfd5e7` docs: sync STATUS / SESSION / AGENT / README / CLAUDE; add CHANGELOG

## Wave 7 — Vitest unit tests + e2e triage (2026-05-13)

- `43805f6` fix: DISMISS short-circuit, seed admin promotion, PUSH-5 spec
- `d196a10` fix: resolve 15 desktop-chromium e2e failures + a11y nested-interactive
- `d4590b9` test: Vitest unit tests for service-layer business logic (115 tests, 5 spec files)
- `6618aa4` payments: dev simulate-success flow, tier-changed event, downgrade modal

## Wave 6 — Production infra + catch-up migration (2026-05-13)

- `02ebbea` db: catch-up migration phases A-G + prod baseline workflow docs
- `895ff13` infra: production Dockerfiles, Caddyfile, compose, CI sourcemaps, deploy scaffold

## Wave 5 — Wave 4 reviewer follow-ups + e2e expansion (2026-05-13)

- `241086e` fix: Wave 5 reviewer findings — audit-log fidelity, banned-login, OTP banner
- `e26ffba` test: Wave 4/5 E2E coverage — payments, sessions, moderation, push-tokens (36 specs)
- `b4a3fa6` fix: Wave 4 reviewer findings — build, simulate-success guard, push, sessions, availability

## Wave 4 — Phase E/G/H/J/L ship + reviewer (2026-05-12)

- `e1a8cab` mobile-chat: WhatsApp-style tabs, swipe-to-archive, and in-thread search
- `f85d2e1` moderation: Phase G — report triage, mod queue, ban policy, Aadhaar denylist enforcement
- `9064841` mentees: My Mentees view + chat-to-journal long-press wiring (Phase L partial)
- `43a5f5d` sessions: Phase H — 1:1 session booking UI + simulated escrow
- `c24aa44` mobile: Wave-3 visual + interaction parity with web
- `3ac77ec` payments: Phase E — FREE/BASIC/PRO/MAX subscription tiers with Razorpay
- `fad8e79` push: wire Expo push notifications for offline messages and chat requests
- `47107b4` auth: wire real Google OAuth sign-in (Phase J)

## Wave 3 — Mobile parity + animations + a11y + i18n + dark mode (2026-05-12)

- `071c0f4` infra: footer contrast fix, pnpm onlyBuiltDependencies, GitHub Actions CI
- `8b1502c` fix: PII leak in /journals/:id/audit + chat Sent tab role-aware filter
- `13d40a1` a11y: integrate axe-playwright + keyboard navigation tests
- `246bbe4` i18n: scaffold next-intl with English-only translations
- `0b0f0af` theme: light + dark mode with system-preference auto-detect + toggle
- `f1437e9` onboarding: polish welcome flash background + role pick visuals
- `7587907` mentors: recover list polish (search + filters + sort + skeleton + illustrated empty)
- `628a173` journals: wire category-icons + relative-time into list page
- `a294516` motion: add Framer Motion animations across the web app
- `9df6cf2` observability: wire PostHog + Sentry across web, api, and mobile
- `3c081f1` skeletons: add skeleton loaders and illustrated empty states
- `45f6112` chat: WhatsApp-style archive tabs + message report flow
- `1a47fb7` getapp: rebuild /get-app landing + manifest + dev-badge fix
- `c75a616` journals: Notion-style page index with icons, counts, breadcrumbs

## Wave 2 — Auto-formatter cleanup (2026-05-12)

- `e8de98e` landing: wire app/page.tsx to use the 9-section landing components
- `05745e2` chore: integrate linter-resolved working tree after Wave 1 agent merge
- `9f09dfa` landing: fix invalid ChipPicker props introduced by auto-formatter

## Wave 1 — B2C polish (landing + dashboard + onboarding + mentors) (2026-05-11/12)

- `f0a44bd` mentors: Airbnb-quality discovery list + polished profile page
- `b285347` onboarding: polish wizard to reduce drop-off
- `d2424dc` auth: B2C-grade login + OTP flow redesign
- `dc57622` dashboard: rebuild sidebar + top bar + first-day dashboard experience
- `b3d7504` landing: B2C-grade landing page with 9 sections
- `4ac52ef` ux: FB1-3 + Inter font + OG image + favicon + dev-badge off + headers
- `7622e86` test: Playwright E2E suite (17 tests: security regressions + onboarding + redirect)
- `974e5b1` ux: light B2C theme (blue-600 primary, slate neutrals, soft avatar tiles)
- `3f3717f` security: HMAC refresh tokens + CSPRNG OTP + chat-request PII strip + tighter CORS + throttler + helmet + log redact

## Phase A-D — Spec alignment (2026-05-11)

- `f587c27` docs: README, CLAUDE, AGENT, SESSION, STATUS, RUNBOOK, ARCHITECTURE (initial doc set)
- `4415b14` Phase D: journals (categories + shared presence gating + audit log)
- `02f9124` Phase C: mentor discovery + 160-char chat request flow
- `6ed2611` Phase B: pre-auth role pick + 12-screen Mirror + mentor onboarding
- `28d0939` Phase A: spec-aligned schema + anonymity layer (handles + letter avatars)

## Phase 0-3 — Foundation (earlier)

- `a18ee50` Gate Socket.IO Redis adapter behind SOCKET_REDIS_ADAPTER env flag
- `9ca2552` Phase 3: admin module (users, assignments, audit log)
- `f9bda40` Phase 2: chat (Socket.IO + REST + assignments)
- `822d7d1` Phase 1: auth (OTP + JWT + refresh rotation + RBAC)
- `2ca9ebe` Phase 0: bootstrap monorepo (web + mobile + api + packages + local infra)
