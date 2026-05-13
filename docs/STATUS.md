# Mento — Phase Status

> Last updated: 2026-05-13. Single source of truth for what's shipped, what's pending, and what to build next. Updated at the end of every coding session.

## TL;DR

**71 commits on `main`. 100% of in-scope MVP is shipped.** Foundation (0-3) + spec alignment (A-D) + payments (E) + sessions (H) + Google OAuth (J) + moderation (G) + chat/journal polish (L) + production infra + test coverage + Waves 9-13 (env/build fixes, admin analytics + feature flags + beta invites, onboarding nudges, perf indexes, SEO/OG/sitemap, EAS mobile pipeline, full PostHog taxonomy). The only remaining items are spec-deferred to v1.1 (broadcast feed, real escrow, Coordinator dashboard).

Latest commit: `145c3f2 security: per-phone OTP rate limits + brute-force lockout` (15 waves shipped, 142 unit tests).

## Wave history

| Wave | Scope | Status |
|---|---|---|
| 1 | B2C polish (landing + dashboard + onboarding + mentors) | shipped |
| 2 | Auto-formatter / linter cleanup | shipped |
| 3 | Mobile parity + animations + a11y + i18n + dark mode | shipped |
| 4 | Phase E/G/H/J/L ship + reviewer | shipped |
| 5 | Wave 4 reviewer follow-ups + e2e expansion | shipped |
| 6 | Production infra + catch-up migration | shipped |
| 7 | Vitest unit tests + e2e triage + DISMISS bug fix | shipped |
| 8 | Wave-8 release-blocker batch (env rename, legal pages, k6, docs) | shipped |
| 9 | DB enum sync, mobile `load()` Promise, .npmrc, .dockerignore, prose plugin | shipped |
| 10 | Full e2e validation (rolled into Wave 9) | shipped — all green |
| 11 | Admin analytics + feature flags + beta invites | shipped |
| 12 | Onboarding nudges + hygiene + perf indexes + SEO/OG + module-registration fixes | shipped |
| 13 | EAS mobile build pipeline + PostHog event taxonomy + Wave 12 review fixes | shipped |

## Done

### Phase 0 — Bootstrap (commit `2ca9ebe`)
- Turborepo + pnpm workspaces; `apps/{api,web,mobile}`; `packages/{types,api-client,validation,hooks,config}`
- `infra/docker/docker-compose.local.yml` (Postgres :5433 + Redis :6380)

### Phase 1 — Auth (commit `822d7d1`, hardened `3f3717f`)
- NestJS phone OTP + JWT (15m + 30d refresh + rotation + theft detection) + MSG91 (dev mode prints OTP)
- HMAC refresh tokens + CSPRNG OTP + tighter CORS + throttler + helmet + log redaction
- Banned users rejected at OTP-verify and Google sign-in (`241086e`)

### Phase 2 — Chat (commit `f9bda40`, gated adapter `a18ee50`)
- REST + Socket.IO gateway (7 events) + idempotent persistence via `clientMessageId`
- Web + mobile chat UIs (typing, read receipts, status)

### Phase 3 — Admin (commit `9ca2552`)
- Admin users / assignments / audit modules + role-gated layout

### Phase A — Spec-aligned schema + anonymity (commit `28d0939`)
- 30+ Prisma models, 16 enums, `apps/api/src/common/anonymity.ts`
- All public responses anonymized to `displayHandle` + `avatarLetter` + `avatarColor` + `hasPurpleTick`

### Phase B — Onboarding (commit `6ed2611`, polish `b285347` `f1437e9`)
- Pre-auth role pick + 12-screen Mirror (mentee) + 4-step mentor wizard
- Copy lifted verbatim from spec → `apps/{web,mobile}/lib/copy.ts`

### Phase C — Mentor discovery + chat request (commit `02f9124`, polish `f0a44bd` `7587907`)
- `/mentors` list + detail + 160-char intro modal with 30/day rate-limit

### Phase D — Journals (commit `4415b14`, polish `c75a616` `628a173`)
- 17 categories + presence-gated edits for shared journals + audit log + `POST /journals/save-from-chat` (PRO)

### Phase E — Payments (commit `3ac77ec`, polish `6618aa4`)
- FREE/BASIC/PRO/MAX subscriptions + Razorpay HMAC webhook + `TierGuard` + `@MinTier` global guard
- Dev simulate-success flow, `mento:tier-changed` event, downgrade modal

### Phase G — Moderation (commit `f85d2e1`, fixes `241086e` `43805f6` `e973fb8`)
- Report queue + 5-message context + DISMISS / WARN / SUSPEND / BAN actions
- BAN writes Aadhaar hash to `MentorDenylist`; SUSPEND/BAN revokes tokens + deletes push tokens
- DB enum sync for `DISMISS` + `SUSPEND_*` values (`e973fb8`)

### Phase H — 1:1 sessions UI + simulated escrow (commit `43a5f5d`, fixes `b4a3fa6`)
- Availability + booking sheet + simulated HOLD / CAPTURE / REFUND `WalletTransaction`
- Real Razorpay escrow deferred to v1.1 (August)

### Phase J — Google OAuth + observability (commit `47107b4`, `9df6cf2`)
- `POST /auth/google` via `google-auth-library` + PostHog + Sentry on web/api/mobile

### Phase L — Chat→Journal + WhatsApp tabs + My Mentees (`45f6112` `9064841` `e1a8cab`)
- WhatsApp-style archive tabs (web + mobile) + chat-to-journal long-press + `GET /mentors/mentees`
- Mobile parity: pill tabs, skeleton, pull-to-refresh, swipe-to-archive, in-thread search

### Push notifications (commit `fad8e79`, fix `b4a3fa6`)
- Global `NotificationsService` batches Expo push (100/req) + `DeviceNotRegistered` auto-cleanup

### Production infra (commit `895ff13`, fixes `36ad73c`)
- 3-stage `Dockerfile.{api,web}` + `Caddyfile` (auto TLS / HSTS / encode) + `docker-compose.prod.yml`
- `.npmrc` (`inject-workspace-packages=true`), `.dockerignore`, Sentry secret mount via BuildKit
- GitHub Actions CI with sourcemap upload to Sentry, deploy scaffold

### Catch-up migration (commit `02ebbea`, `e973fb8`)
- `20260513000000_catch_up_phases_a_through_g` brings prod schema to Phase A-G state
- Includes `DISMISS`, `SUSPEND_ASPIRANT`, `SUSPEND_MENTOR` enum values

### Wave 11 — Admin analytics + feature flags + beta invites
- **Analytics** (`27e2c2c`, fixed `f146c44`): `/admin/analytics` dashboard — DAU/MAU, signup funnel, MRR, conversion, mentor verification counts. 60s Redis cache.
- **Feature flags** (`889f839`, `6c69e44`): server-driven flag system with `FeatureFlag` table, public `/flags` + admin `/admin/flags` API, web + mobile `FeatureFlagsProvider` (60s poll), `useFeatureFlag()` hook, `POST /admin/flags/seed` to seed defaults (`chat-search: true`, others `false`), 30s cache.
- **Beta invites** (`fd6a7f2`): `InviteCode` + `InviteRedemption` tables, admin `/admin/invites` UI, redeem-on-signup gating via `BETA_INVITE_REQUIRED`, race-safe `UPDATE ... WHERE uses < maxUses` SQL (`f146c44`).

### Wave 12 — Nudges + hygiene + perf + SEO
- **Onboarding nudges** (`7b38155`): `@nestjs/schedule` crons — `0 */6 * * *` mirror nudge, `0 */12 * * *` mentor nudge. 7-day dedup via `OnboardingEvent` rows. 500-row cap. Admin `POST /admin/nudges/trigger`. Anonymity-clean push bodies (no handle/phone/email).
- **Hygiene** (`30da2e1`): drop unused imports + dead `this.redis` in `auth.service.ts` + fix shimmer (use `opacity.value`) + Sentry `--mount=type=secret` + `caddy fmt`.
- **Perf indexes** (`24a9e3e`): partial indexes on `User.createdAt` and `Message.createdAt` (`WHERE deletedAt IS NULL`); Socket.IO Redis adapter audited; `mentors:list` cache (30s TTL) with invalidation on approve/reject/ban.
- **SEO** (`d76b0b5`): `sitemap.ts`, `robots.ts` (route-group → real-path paths fixed in `da593bc`), per-route `opengraph-image.tsx`, metadata + JSON-LD on landing.
- **Wave 11 review fixes** (`f146c44`): `AnalyticsModule`/`FlagsModule` registered in `AppModule`, race-safe invite redemption, `api-client` types corrected.

### Wave 13 — EAS mobile + analytics taxonomy
- **EAS pipeline** (`7bd6a9f`): `eas.json` (development/preview/production profiles), `app.json` spec-aligned, `apps/mobile/STORE.md`, `apps/mobile/store-screenshots/README.md` capture spec.
- **PostHog event taxonomy** (`4c62d52`): 40-event catalog (`docs/ANALYTICS_EVENTS.md`), 39 web + 26 mobile call sites + 5 server-side `OnboardingEvent` rows. UUID-only identify; never PII in props.
- **Wave 12 review fixes** (`da593bc`): `@nestjs/schedule` added to `apps/api/package.json`, `robots.ts` paths replaced with real URL prefixes.

### Test coverage (commits `7622e86` `e26ffba` `13d40a1` `d4590b9` `d196a10`, expanded through Wave 13)
- **127 Vitest unit tests** across service-layer specs (anonymity, auth, moderation, subscriptions, sessions, nudges, invites, analytics, flags).
- **40 API e2e** (Playwright) — all green after admin seed.
- **66 desktop-chromium e2e** (axe-playwright a11y + keyboard nav + payments + moderation + onboarding) — all green.
- **Web production build green** — 39 routes, all dynamic + 5 SEO routes (sitemap, robots, OG images).

### Wave 1-3 UX polish (multiple commits)
- B2C light theme + Inter font + OG image + favicon (`974e5b1` `4ac52ef`)
- 9-section landing + `/get-app` rebuild (`b3d7504` `e8de98e` `1a47fb7`)
- Dashboard + sidebar rebuild (`dc57622`)
- Auth flow redesign (`d2424dc`); onboarding wizard polish (`b285347` `f1437e9`)
- Skeleton loaders + illustrated empty states (`3c081f1`); Framer Motion (`a294516`)
- Light + dark theme + next-intl scaffold (`0b0f0af` `246bbe4`)
- axe-playwright a11y + keyboard nav (`13d40a1`); mobile Wave-3 parity (`c24aa44`)

### Legal pages + release-blocker batch (commit `451f694`, Wave 9 fix `e973fb8`)
- `/privacy`, `/terms`, `/refund-policy` live in `app/(legal)/` group
- `@tailwindcss/typography` registered → legal prose renders correctly
- Env var rename `NEXT_PUBLIC_API_URL` → `NEXT_PUBLIC_API_BASE_URL`, missing prod env vars added
- k6 load test suite + `loadtest/SCALING_PLAYBOOK.md`

## Pending — spec-deferred only

| # | Phase | Description | Status |
|---|---|---|---|
| 1 | **K** | Broadcast mentor request feed | Spec defers to v1.1 |
| 2 | **F** | Mentor verification: R2 pre-signed URL endpoint + upload UI + admin queue | Admin promotes manually for first cohort; deferred |
| 3 | — | Coordinator dashboard | Schema in place, post-MVP per spec |
| 4 | — | Real Razorpay escrow for 1:1 sessions | Deferred to v1.1 (August) |

## Operational follow-ups

- **Admin promotion**: `pnpm --filter @mento/api db:seed` promotes existing user via `ADMIN_BOOTSTRAP_PHONE`. Required for moderation routes.
- **Catch-up migration**: prod baseline workflow in `docs/DEPLOY.md` — `prisma migrate resolve` for init + catch-up + perf-indexes migrations.
- **Feature flag seed**: after first prod deploy, POST `/admin/flags/seed` (admin token) to insert defaults.
- **EAS credentials**: Apple / Google developer accounts must be provisioned for store builds. See `apps/mobile/STORE.md`.

## Test status

| Suite | Result | Notes |
|---|---|---|
| Vitest unit (`apps/api && pnpm test`) | 127 pass | service-layer business logic across 9 spec files |
| Playwright API e2e | 40 / 40 pass | requires admin seed |
| Playwright browser e2e | 66 / 66 pass | desktop-chromium + axe a11y + keyboard nav |
| Web production build | Green | 39 routes (Next.js 15 standalone) |
| Docker `Dockerfile.api` build | Green (433 MB, ~60 s) | `--frozen-lockfile` clean |
| Prod compose `config` parse | Green | no missing-var warnings (env-i wrapper recommended) |

## Production infra status

- Docker images: API + web build via 3-stage multi-stage builds (non-root + tini + healthcheck).
- Caddy: TLS auto-issue + HSTS + zstd/gzip + security headers verified.
- Compose: 5 services (postgres, redis, api, web, caddy), healthcheck-gated boot order. Postgres + Redis NOT exposed on host.
- CI: GitHub Actions builds + uploads sourcemaps to Sentry via BuildKit `--mount=type=secret`.
- Mobile: EAS profiles (development / preview / production) defined in `eas.json`; store metadata in `apps/mobile/STORE.md`.
- Observability: PostHog (autocapture off, explicit `capture()`), Sentry on all three apps, pino redact (phone/email/aadhaarHash/token).

## Open product decisions (validate during testing)

1. Founding mentor cohort terms (equity? rev share? badge-only?)
2. Anonymity-vs-verification explainer copy for Aadhaar upload
3. Tier inclusion lines for Basic/Pro/Max (prices are placeholders)
4. A/B: hard paywall day 1 vs 7-day Basic trial
5. Mentor recruitment plan (Telegram survey from spec)
