# Mento — Phase Status

> Last updated: 2026-05-13. Single source of truth for what's shipped, what's pending, and what to build next. Updated at the end of every coding session.

## TL;DR

53 commits on `main`. MVP scope shipped end-to-end: foundation (0-3) + spec alignment (A-D) + payments (E) + sessions (H) + Google OAuth (J) + moderation (G) + chat/journal polish (L) + production infra + test coverage. Phase K (broadcast request) is the only deferred MVP slice per spec. Outstanding operational items: admin-seed promotion step for full e2e, and the docs you're reading.

## Done

### Phase 0 — Bootstrap (commit `2ca9ebe`)
- Turborepo + pnpm workspaces
- `apps/{api,web,mobile}` scaffolds
- `packages/{types,api-client,validation,hooks,config}`
- `infra/docker/docker-compose.local.yml` (Postgres :5433 + Redis :6380)
- Base configs (tsconfig, prettier, editorconfig, gitignore)

### Phase 1 — Auth (commit `822d7d1`, hardened `3f3717f`)
- NestJS `auth` module with phone OTP + JWT (15m access + 30d refresh) + refresh-token rotation + theft detection
- MSG91 integration (dev mode prints OTP, prod sends SMS)
- RBAC guard + `@Roles()` decorator + `@Public()` decorator
- HMAC-signed refresh tokens + CSPRNG OTP + tighter CORS + throttler + helmet + log redaction (`3f3717f`)
- Banned users rejected at OTP-verify and Google sign-in (`241086e`)
- `/me` endpoint
- Web `/login` + `/otp` + auth store (Zustand persisted)
- Mobile `(auth)/login` + `(auth)/otp` + secure-store wiring

### Phase 2 — Chat (commit `f9bda40`, gated adapter `a18ee50`)
- `chat` module: REST (list conversations, get messages) + Socket.IO gateway (7 events)
- Idempotent message persistence via `clientMessageId`
- Conversation/message Prisma models
- `assignments` module: admin pair mentor↔aspirant
- Web chat UI (list + thread with typing, read receipts, status)
- Mobile chat UI (stack-in-tab with FlatList, KeyboardAvoidingView)

### Phase 3 — Admin (commit `9ca2552`)
- Admin module: list users (filterable), set role, approve mentor, list audit logs
- Web `/admin/{users,assignments,audit,page}` with role-gated layout
- Sidebar with conditional Admin link

### Phase A — Spec-aligned schema + anonymity (commit `28d0939`)
- 30+ Prisma models incl. MenteeProfile, MentorProfile, VerificationDocument, MentorDenylist, ChatRequest, ConversationPresence, Journal, JournalEntry, JournalAuditLog, SessionRequest, Session, WalletTransaction, Subscription, Review, MessageReport, ModerationActionLog, OnboardingEvent
- 16 new enums (AvatarLetter, AvatarColor, JourneyStage, MentorJourney, JournalCategory, …)
- `apps/api/src/common/anonymity.ts` — handle generator, letter logic, color mapping
- All API responses anonymized: `displayHandle` + `avatarLetter` + `avatarColor` + `hasPurpleTick`, never `displayName`/`avatarUrl`
- `LetterAvatar` components (web + mobile)

### Phase B — Onboarding rework (commit `6ed2611`, polish `b285347` `f1437e9`)
- API `onboarding` module: `/role`, `/event`, `/state`, `/mirror`, `/mentor`
- Pre-auth role pick (Aspirant vs Mentor)
- Timed FlashSequence component (web + mobile, fade in/out)
- 7-step Mirror wizard (mentee) + 4-step mentor wizard
- `submitMirror` bumps avatar letter based on journey stage; `submitMentor` auto-promotes ASPIRANT→MENTOR
- All copy lifted verbatim from spec → `apps/{web,mobile}/lib/copy.ts`

### Phase C — Mentor discovery + chat request (commit `02f9124`, polish `f0a44bd` `7587907`)
- API `mentors` module: list with filters + detail with metrics + reviews
- API `chat-requests` module: 160-char intro, accept/decline/archive, 30/day rate-limit
- Web `/mentors` (list) + `/mentors/[id]` (profile with timeline + reviews + 160-char modal)
- Mobile `(tabs)/mentors` stack

### Phase D — Journals (commit `4415b14`, polish `c75a616` `628a173`)
- API `journals` module: 17 categories (Personal + Prelims×8 + Mains×6 + Interview + Shared-with-mentor)
- Presence-based edit gating for shared journals (`ConversationPresence` table)
- Full audit log (`JournalAuditLog`: CREATE/EDIT/APPEND/DELETE/LOCK/UNLOCK), auto-lock on archive
- `POST /journals/save-from-chat` endpoint (PRO-gated via `@MinTier`)
- Notion-style category page index + relative-time formatting

### Phase E — Payments / subscription tiers (commit `3ac77ec`, polish `6618aa4`)
- `subscriptions` module: `GET /me`, `POST /checkout`, `/cancel`, `/webhook`, `/simulate-success`
- `TierGuard` + `@MinTier` decorator wired as global `APP_GUARD`
- `@MinTier(PRO)` applied to `POST /journals/save-from-chat`
- Razorpay HMAC-SHA256 webhook signature verification
- Web `/upgrade` page with tier cards + downgrade modal
- Dev simulate-success flow (no NEXT_PUBLIC_RAZORPAY_KEY_ID), `mento:tier-changed` event keeps sidebar badge in sync

### Phase G — Moderation (commit `f85d2e1`, fixes `241086e` `43805f6`)
- `/admin/moderation/reports` queue + detail with 5-message author context
- `PATCH /reports/:id/resolve` actions: `DISMISS` / `WARN` / `SUSPEND` / `BAN`
- BAN writes Aadhaar hash to `MentorDenylist`; SUSPEND/BAN revokes refresh tokens and deletes push tokens
- DISMISS short-circuit fix (was previously falling through to SUSPEND)
- Banned users rejected at login

### Phase H — 1:1 sessions UI + simulated escrow (commit `43a5f5d`, fixes `b4a3fa6`)
- `sessions` module: `availability/:mentorId`, `requests` POST/list/accept/cancel
- Simulated HOLD `WalletTransaction` on request, CAPTURE on accept, REFUND on cancel
- 5-concurrent-PENDING cap per mentee
- Web `/sessions/availability` + `BookingSheet` with weekday/weekend hours
- Real Razorpay escrow defers to v1.1 (August)

### Phase J — Google OAuth + observability (commit `47107b4`, observability `9df6cf2`)
- `POST /auth/google` verifies GSI ID token via `google-auth-library`
- Looks up by `googleSub`, creates `Aspirant_NNNN` on first sign-in
- PostHog SDK + Sentry init on web, api, mobile

### Phase L — Chat→Journal + WhatsApp tabs + My Mentees (partial — commits `45f6112` `9064841` `e1a8cab`)
- WhatsApp-style chat archive tabs (All / Pending|Sent / Archived) with badge counts
- Chat-to-journal long-press wiring + message report flow
- `GET /mentors/mentees` MENTOR-only view with conversation + unread + shared journal
- Mobile parity: pill tabs, skeleton, pull-to-refresh, swipe-to-archive, in-thread search

### Push notifications (commit `fad8e79`, fix `b4a3fa6`)
- Global `NotificationsService` batches to Expo push API (100/req)
- `POST /push-tokens` + `DELETE /push-tokens/:token`
- DeviceNotRegistered auto-deletes stale tokens
- Mobile foreground listener wired

### Production infra (commit `895ff13`)
- `infra/docker/Caddyfile` — Caddy reverse proxy for `api.mento.in` + `mento.in` with auto TLS, HSTS, gzip+zstd
- `Dockerfile.api` — 3-stage NestJS build, pnpm prune, non-root + tini, healthcheck
- `Dockerfile.web` — 3-stage Next.js standalone build
- `docker-compose.prod.yml` — caddy + api + web + postgres + redis, healthcheck-gated boot
- GitHub Actions CI with sourcemap upload to Sentry
- `docs/DEPLOY.md` first-prod-deploy baseline workflow

### Test coverage (commits `7622e86` `e26ffba` `13d40a1` `d4590b9` `d196a10`)
- Vitest: 115 unit tests across 5 spec files (anonymity, auth, moderation, subscriptions, sessions)
- Playwright API e2e: 34/40 pass (payments, sessions, moderation, push-tokens, security regressions, onboarding); 6 require admin-seed promotion
- Playwright browser e2e: 61 pass / 5 skip (desktop-chromium, axe-playwright a11y, keyboard nav)
- Web production build green

### Wave 1-3 UX polish (multiple commits)
- B2C light theme + Inter font + OG image + favicon (`974e5b1` `4ac52ef`)
- 9-section landing page + `/get-app` rebuild (`b3d7504` `e8de98e` `1a47fb7`)
- Dashboard + sidebar rebuild (`dc57622`)
- Auth flow redesign (`d2424dc`)
- Onboarding wizard polish (`b285347` `f1437e9`)
- Mentor list + profile polish (`f0a44bd` `7587907`)
- Skeleton loaders + illustrated empty states (`3c081f1`)
- Framer Motion animations (`a294516`)
- Light + dark theme with system-preference auto-detect (`0b0f0af`)
- next-intl scaffold (English only, `246bbe4`)
- axe-playwright a11y + keyboard nav (`13d40a1`)
- Mobile Wave-3 visual parity with web (`c24aa44`)

## Pending — by impact

| # | Phase | Description | Status |
|---|---|---|---|
| 1 | **K** | Broadcast mentor request feed (Plus button, free-text + filters, matching, feed) | Spec defers to v1.1 |
| 2 | **F** | Mentor verification: R2 pre-signed URL endpoint, Aadhaar/hall-ticket/marks upload UI, admin verification queue | Admin can do manually for first cohort; deferred |
| 3 | — | Coordinator dashboard | Schema in place, deferred to post-MVP |
| 4 | — | Real Razorpay escrow for 1:1 sessions | Deferred to v1.1 (August) |
| 5 | — | Mentor verification queue UI (admin) | Tied to F |

## Operational follow-ups

- **Admin-seed promotion**: 6 of the 40 API e2e tests require an existing user be promoted to ADMIN via `pnpm --filter @mento/api db:seed` after first OTP-verify. The seed script now promotes existing users (`43805f6`).
- **Catch-up migration**: `20260513000000_catch_up_phases_a_through_g` (`02ebbea`) brings prod schema to the current state; baseline workflow documented in `docs/DEPLOY.md`.

## Test status

| Suite | Result | Notes |
|---|---|---|
| Vitest unit (`apps/api && pnpm test`) | 115 pass | anonymity / auth / moderation / subscriptions / sessions |
| Playwright API e2e | 34/40 pass | 6 need admin-seed promotion |
| Playwright browser e2e | 61 pass / 5 skip | desktop-chromium, includes axe a11y + keyboard |
| Web production build | Green | Next.js standalone output |

## Open product decisions (validate during testing)

1. Founding mentor cohort terms (equity? rev share? badge-only?)
2. Anonymity-vs-verification explainer copy for the Aadhaar upload screen
3. Exact tier inclusion lines for Basic/Pro/Max (prices are placeholders)
4. A/B test: hard paywall on day 1 vs 7-day Basic trial
5. Mentor recruitment plan (Telegram survey from spec)
