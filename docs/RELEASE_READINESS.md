# Release Readiness Audit — 2026-05-13 (Wave 13)

## Verdict

**GREEN — ready for soft-launch and paid promotional traffic, subject to operator-side credential provisioning.** All 7 Wave-8 blockers were resolved across Waves 9-13. The platform now ships a clean Docker build (433 MB API image, ~60 s build), green test suites (127 unit + 40 API e2e + 66 browser e2e, all pass), production Compose validates with no missing env vars, and the SEO + OG + analytics + feature-flag + onboarding-nudges + EAS pipeline layers are wired. The remaining items are operational pre-launch credentials (Razorpay live keys, MSG91 DLT, Sentry DSN, EAS Apple/Google accounts, R2 bucket) rather than code defects.

The earlier Wave-8 YELLOW verdict cited 7 blockers — every one is now closed (see "Wave-8 blocker reconciliation" below).

---

## Go/no-go matrix (Wave 13)

| # | Category | Status | Notes |
|---|---|---|---|
| 1 | Anonymity & Privacy | OK | Public routes anonymized via `displayHandle` + `avatarLetter` + `avatarColor` + `hasPurpleTick`. Analytics props UUID-only. Push bodies clean of PII. PostHog `identify()` is UUID; `capture()` never carries phone/email/handle. |
| 2 | Auth & Session Security | OK | HMAC refresh tokens; CSPRNG OTP; CORS allowlist; throttler global guard; banned users rejected at OTP-verify + Google sign-in. JwtAuthGuard / RolesGuard / TierGuard wired as `APP_GUARD`. |
| 3 | Payments | OK | Razorpay HMAC-SHA256 webhook with timing-safe compare; `simulate-success` is `NODE_ENV !== 'production'` gated; `RAZORPAY_PLAN_BASIC/PRO/MAX` present in compose + env example. |
| 4 | Moderation & Trust | OK | DISMISS / WARN / SUSPEND / BAN all write `ModerationActionLog`. DB enum sync confirmed in catch-up migration. BAN revokes tokens + push tokens + writes Aadhaar hash to `MentorDenylist`. |
| 5 | Real-time + Push | OK | `SOCKET_REDIS_ADAPTER=true` opt-in for horizontal scale. Expo Push batched (100/req) with `DeviceNotRegistered` auto-cleanup. `EXPO_ACCESS_TOKEN` documented in compose + env example. |
| 6 | Database | OK | Three migrations (`init` → `catch_up_phases_a_through_g` → `perf_indexes_analytics`). Partial indexes on `User.createdAt`, `Message.createdAt` (`WHERE deletedAt IS NULL`). Hot-path composites on Message, OtpRequest, RefreshToken, ChatRequest. |
| 7 | Infrastructure | OK | Multi-stage Dockerfiles + non-root + tini + healthchecks + Caddy auto-TLS + HSTS + zstd/gzip. Sentry token via BuildKit `--mount=type=secret`. Prod compose `config` parses with zero warnings. |
| 8 | Observability | OK | Sentry on web/api/mobile; PostHog autocapture off, explicit `capture()` only (40 events catalogued in `docs/ANALYTICS_EVENTS.md`); pino redact covers phone/email/aadhaarHash/token. No `console.log` in production code paths. |
| 9 | Testing | OK | 127 Vitest unit pass; 40/40 API e2e pass; 66/66 desktop-chromium pass (incl. axe a11y + keyboard nav). Mobile typecheck green; EAS profiles in place but no device CI yet. |
| 10 | Documentation | OK | README, CLAUDE, AGENT, SESSION, STATUS, CHANGELOG, RUNBOOK, DEPLOY, ARCHITECTURE, SECURITY, ANALYTICS_EVENTS, plus Wave reviews 4-12 + INTEGRATION + FINAL_VALIDATION + PROD_COMPOSE_SMOKE. |
| 11 | UX & Accessibility | OK | WCAG 2.1A axe rules pass on all authenticated pages (nested-interactive fixed). `/privacy`, `/terms`, `/refund-policy` live + linked from footer + listed in robots Allow. Dark mode + `next-intl` scaffold + Framer Motion. |
| 12 | Mobile | OK | EAS profiles configured (`eas.json`), `app.json` spec-aligned, `STORE.md` + `store-screenshots/README.md` written. Three apps typecheck. Phase L mobile parity shipped. |
| 13 | Performance / Scale | OK | k6 scripts present (3 scenarios) + `SCALING_PLAYBOOK.md` documented. Redis adapter opt-in. `mentors:list` 30 s cache + admin-analytics 60 s + flags 30 s. Throttler tuned for shared-NAT India. |
| 14 | Legal / Policy | OK | `/privacy`, `/terms`, `/refund-policy` live with `@tailwindcss/typography` prose styling. Aadhaar hash-only. PostHog autocapture off (consent surface optional). |
| 15 | Known deferred items | OK | Coordinator dashboard, broadcast feed, real escrow, Aadhaar provider integration — all flagged in STATUS.md and align with spec deferral. |

---

## Wave-8 blocker reconciliation (all resolved)

| # | Wave-8 blocker | Resolution | Commits |
|---|---|---|---|
| 1 | WCAG nested-interactive on authenticated pages | Fixed; axe a11y suite passes (66/66 browser e2e green) | `d196a10` + Wave 9/10 validation `09b5dea` |
| 2 | No privacy / terms / refund pages | Pages live + footer links + `@tailwindcss/typography` registered + robots Allow | `451f694` + `e973fb8` |
| 3 | `RAZORPAY_PLAN_BASIC/PRO/MAX` missing from env | Added to `.env.prod.example` and compose | `451f694` |
| 4 | `EXPO_ACCESS_TOKEN` + `SOCKET_REDIS_ADAPTER` missing | Added to `.env.prod.example` and compose | `451f694` |
| 5 | Admin DB seed (`db:seed` promotes existing user) | Seed promotes existing user if found by phone; doc updated in DEPLOY.md | `43805f6` |
| 6 | M3 — BANNED user OTP gap | Verified BANNED check is present in `verifyOtp` and `googleSignin`; banned users rejected | `241086e` |
| 7 | Chat empty-state wrong copy | Corrected — references mentor discovery, not admin assignment | Wave 1-3 polish + Phase C |

---

## Outstanding pre-launch operator tasks

These are NOT code defects — they are credentials and one-time ops actions a real human must perform before flipping DNS.

### Mandatory before paid promotional spend

- [ ] Provision Razorpay live keys: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- [ ] Create Razorpay plans in dashboard, set `RAZORPAY_PLAN_BASIC` (₹399/mo), `RAZORPAY_PLAN_PRO` (₹599/mo), `RAZORPAY_PLAN_MAX` (₹999/mo)
- [ ] MSG91 DLT template approved (5-7 business days), set `MSG91_API_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_SENDER_ID`, `MSG91_ENABLED=true`
- [ ] Sentry project provisioned: `SENTRY_DSN_API`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (and GH Secret `SENTRY_AUTH_TOKEN` for the BuildKit secret mount)
- [ ] PostHog project provisioned: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_API_KEY`
- [ ] Cloudflare R2 bucket: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL`, `S3_BUCKET`
- [ ] EAS provisioned: Apple Developer + Google Play accounts linked; `EXPO_PROJECT_ID` set; `EXPO_ACCESS_TOKEN` minted; first builds run via `eas build --profile production --platform all`
- [ ] Mobile assets directory populated (`apps/mobile/assets/` + `store-screenshots/`) per `apps/mobile/STORE.md`
- [ ] Google OAuth client ID created: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (`openssl rand -hex 64` each); `POSTGRES_PASSWORD` + `REDIS_PASSWORD` set to strong randoms
- [ ] DNS A records: `mento.in`, `www.mento.in`, `api.mento.in` → server IP
- [ ] DB baseline: `prisma migrate resolve --applied 20260510181133_init` + `20260513000000_catch_up_phases_a_through_g` + `20260513010000_perf_indexes_analytics` on the prod DB (see `docs/DEPLOY.md`)
- [ ] Admin promotion: set `ADMIN_BOOTSTRAP_PHONE`, run `docker exec mento-api-prod node dist/prisma/seed.js`
- [ ] Feature flags seeded: `POST /admin/flags/seed` with admin token
- [ ] Optional but recommended: enable nudges (`NUDGES_ENABLED=true`) once first cohort signs up; toggle beta gating (`BETA_INVITE_REQUIRED=true`) for closed beta

### Pre-launch smoke verification

- [ ] `docker compose ... config` exits 0 (no missing-var warnings)
- [ ] All 5 containers report healthy after `up -d`
- [ ] `https://api.mento.in/healthz` → `{"status":"ok"}`
- [ ] `https://mento.in` returns HTTP 200; legal pages at `/privacy`, `/terms`, `/refund-policy` render
- [ ] OTP flow end-to-end on a real device (MSG91 delivery, not dev console)
- [ ] Admin login → `/admin` → `/admin/analytics`, `/admin/flags`, `/admin/invites`, `/admin/moderation` all return data
- [ ] Razorpay checkout opens (live key) and `subscription.activated` webhook test succeeds via dashboard
- [ ] Push notification round-trip on a real Expo build (registration → trigger → receipt)
- [ ] Sentry error visible within 60 s of test exception (web + api + mobile)
- [ ] PostHog events visible: complete onboarding → verify `onboarding.*` events appear
- [ ] k6: run `cd /root/Mento/loadtest/k6 && k6 run 01-onboarding.js` against staging — record p95/p99 in `loadtest/results/`

### Legal / policy

- [ ] `https://mento.in/privacy` reachable + linked from Play Store / App Store listings
- [ ] `https://mento.in/terms` reachable
- [ ] `https://mento.in/refund-policy` reachable (Razorpay live key approval requires this)
- [ ] Footer links to Privacy / Terms / Refund / Contact on landing page (already shipped)

### Content / mentor supply

- [ ] First cohort of 10-20 verified mentors onboarded + approved via admin queue
- [ ] Founding-mentor terms communicated (open decision #1 in `docs/STATUS.md`)
- [ ] Sample questions library seeded for beginner mentees (spec §1.13)

---

## Known deferred (not blockers)

1. Coordinator dashboard (schema present; post-MVP per spec).
2. Broadcast mentor request feed (v1.1 per spec §1.11).
3. Real Razorpay escrow for 1:1 sessions (v1.1, August per spec §1.9).
4. Aadhaar UIDAI / DigiLocker verification provider (manual review for first cohort).
5. Voice/video via 100ms (v1.1).
6. Deepgram transcription (v1.1).
7. NLP / regex automated PII detection (v1.1 per spec §1.16).
8. Multi-language UI — `next-intl` scaffolded, English-only for MVP.
9. ML mentor matching (post-PMF).
10. Peer-to-peer interview practice with AI (v1.2).

---

*Audit performed against `da593bc` on branch `main` as of 2026-05-13. All prior Wave-8 blockers resolved across Waves 9-13. Verdict moves from YELLOW to GREEN, gated only on operator-side credential provisioning above.*
