# Mento — Phase Status

> Last updated: 2026-05-11. Single source of truth for what's shipped, what's pending, and what to build next. Updated at the end of every coding session.

## TL;DR

9 commits. Foundation (Phases 0-3) + spec alignment (Phases A-D) shipped. Next slice: **Phase E — Razorpay subscription tiers + paywall**.

## Done

### Phase 0 — Bootstrap (commit `2ca9ebe`)
- Turborepo + pnpm workspaces
- `apps/{api,web,mobile}` scaffolds
- `packages/{types,api-client,validation,hooks,config}`
- `infra/docker/docker-compose.local.yml` (Postgres :5433 + Redis :6380)
- Base configs (tsconfig, prettier, editorconfig, gitignore)

### Phase 1 — Auth (commit `822d7d1`)
- NestJS `auth` module with phone OTP + JWT (15m access + 30d refresh) + refresh-token rotation + theft detection
- MSG91 integration (dev mode prints OTP, prod sends SMS)
- RBAC guard + `@Roles()` decorator + `@Public()` decorator
- `/me` endpoint
- Web `/login` + `/otp` + auth store (Zustand persisted)
- Mobile `(auth)/login` + `(auth)/otp` + secure-store wiring
- Verified live via curl: `/auth/otp/request` → `/auth/otp/verify` → `/me` ✅

### Phase 2 — Chat (commit `f9bda40`)
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
- Schema pushed via `prisma db push` (migration file in `prisma/migrations/`)

### Phase B — Onboarding rework (commit `6ed2611`)
- API `onboarding` module: `/role`, `/event`, `/state`, `/mirror`, `/mentor`
- Pre-auth role pick (Aspirant vs Mentor)
- Timed FlashSequence component (web + mobile, fade in/out)
- 7-step Mirror wizard (mentee): intro → journey → background → reflection → knowledge sliders → challenges → privacy
- 4-step mentor wizard: journey → year-by-year history → subjects/categories/languages → reach&rate
- `submitMirror` bumps avatar letter based on journey stage
- `submitMentor` auto-promotes ASPIRANT→MENTOR + bumps letter
- Mentor "submitted" waiting screen
- All copy lifted verbatim from spec philosophy bank → `apps/{web,mobile}/lib/copy.ts`
- Onboarding analytics events persisted to local `OnboardingEvent` table

### Phase C — Mentor discovery + chat request (commit `02f9124`)
- API `mentors` module: list with filters (verified, interview-attempted, language, optional, max rate) + detail with metrics + reviews
- API `chat-requests` module: create with 160-char intro, list, accept/decline/archive
- Daily abuse rate-limit (30 requests/day per mentee)
- Accept creates Conversation + plants intro as first message
- Web `/mentors` (list) + `/mentors/[id]` (profile with year-by-year timeline + reviews + 160-char modal)
- Mobile `(tabs)/mentors` stack with same flow
- Mentors tab added to sidebar (web) and bottom nav (mobile)

### Phase D — Journals (commit `4415b14`)
- API `journals` module: 17 categories (Personal + Prelims×8 + Mains×6 + Interview + Shared-with-mentor)
- Presence-based edit gating for shared journals (`ConversationPresence` table)
- Chat gateway updates presence on join/leave/disconnect → wires to journals
- Full audit log (`JournalAuditLog`: CREATE/EDIT/APPEND/DELETE/LOCK/UNLOCK)
- Auto-lock on conversation archive (helper `lockSharedJournalsForConversation`)
- Chat-to-journal endpoint (`POST /journals/save-from-chat`)
- Web `/journals` (categories grid) + `/journals/[id]` (editor)
- Mobile `(tabs)/journals` stack with same flow
- Journals tab added to sidebar/nav

## In flight (none)

The previous session ended with Phase D committed. No work in progress.

## Pending — prioritized by impact

| # | Phase | Description | Files | Why |
|---|---|---|---|---|
| 1 | **E** | Razorpay tiers (Basic/Pro/Max) + paywall enforcement on protected routes + webhook handler + `Subscription` table writes | ~10 | Day-1 monetisation per spec |
| 2 | **G** | Report message (long-press) + admin moderation queue + ban with audit + Aadhaar hash denylist enforcement | ~6 | Required for safe launch |
| 3 | **I** | UX polish pass: Lottie hero animations, Reanimated/Moti spring transitions, haptics on mobile, skeleton loaders, empty/error states, motion language | ~20 edits | Critical for the 1M-MAU bar |
| 4 | **F** | Mentor verification: R2 pre-signed URL endpoint, Aadhaar/hall-ticket/marks upload UI, admin verification queue, Aadhaar hash to MentorDenylist on ban | ~8 | Trust signal; admin can do manually for first cohort |
| 5 | **H** | 1:1 booking UI (mentor availability calendar, scheduling sheet, stubbed payment screen marked `simulated`, wallet UI) | ~8 | Validates paid demand without building real escrow |
| 6 | **J** | Google OAuth (Authlib pattern), PostHog SDK init on all 3 surfaces, Sentry init on api+web+mobile, source map upload | ~6 | Production observability |
| 7 | **L** | Long-press chat→journal sheet in chat thread UI; WhatsApp-style chat archive tabs (sent/pending/archived/unanswered); mentor's "My Mentees" view | ~10 | Polish; high-impact UX |
| 8 | **K** | Broadcast mentor request feed (Plus button on Mentors tab, free-text + filters, matching engine, feed) | ~5 | Spec defers to v1.1; nice-to-have |

## Pending — original Phase 0 infra items

| Item | Status |
|---|---|
| GitHub Actions workflows (ci.yml, deploy-dev/uat/prod.yml, mobile.yml) | ❌ |
| Production Dockerfiles for api + web | ❌ |
| Caddyfile for prod/uat | ❌ |
| Vitest unit tests | ❌ |
| Playwright E2E tests | ❌ |
| Push notifications wiring (Expo Push send) | ❌ (token registration scaffolded) |
| Cloudflare R2 storage module | ❌ |

## Open product decisions (validate during testing)

1. Founding mentor cohort terms (equity? rev share? badge-only?)
2. Anonymity-vs-verification explainer copy for the Aadhaar upload screen
3. Exact tier inclusion lines for Basic/Pro/Max (prices are placeholders)
4. A/B test: hard paywall on day 1 vs 7-day Basic trial
5. Mentor recruitment plan (Telegram survey from spec)

## Last verified

- `curl http://localhost:4000/healthz` → 200 (in previous session)
- All 3 apps typecheck clean (last run before session close)
- Postgres + Redis containers running on :5433 and :6380
- 9 commits on `main`, working tree clean (modulo any uncommitted SESSION/STATUS doc additions)
