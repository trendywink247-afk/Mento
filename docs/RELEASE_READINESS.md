# Release Readiness Audit — 2026-05-13

## Verdict

**YELLOW — NOT ready for a paid promotional soft launch.** The core infrastructure is well-engineered and several earlier CRITICAL findings (SEC-1 bcrypt refresh token hash, SEC-3 chat-request PII leak, SEC-2 Math.random OTP, SEC-4 Socket.IO CORS wildcard) have been fixed. The production build is clean and all three apps typecheck. However, a cluster of still-open issues blocks safe monetised launch: five Playwright smoke tests fail (admin DB setup + WCAG nested-interactive violations across all authenticated pages + chat tab count mismatch), two auth security bugs remain (M3: BANNED users can obtain a 15-minute access window via OTP; M5: OTP error page mis-labels banned users as "wrong code"), a critical functional bug means the `listMentees` endpoint surfaces banned/suspended aspirants to mentors, the DISMISS moderation action produces no audit row, and the `setUserStatus` path still logs `SUSPEND_MENTOR`/`SUSPEND_ASPIRANT` which — while the enum now exists — needs verification the schema migration was applied. Beyond bugs: Razorpay plan IDs (`RAZORPAY_PLAN_BASIC/PRO/MAX`) are absent from both `.env.prod.example` and `docker-compose.prod.yml`, `EXPO_ACCESS_TOKEN` and `SOCKET_REDIS_ADAPTER` are undocumented in the prod compose, push notification bodies include user-authored intro text (not PII per se, but worth noting), the landing page has no privacy policy or Terms of Service link (Play Store / App Store hard requirement), the dashboard empty state has wrong copy ("admin will assign you"), and the UX audit catalogues ~22 dev-days of high/blocker UX gaps. For a pure internal beta of 50 invitees these blockers are manageable; for a paid promotional push targeting 10 M MAU in 3 months, 7 of the items below must be resolved first.

---

## Go/no-go matrix

| # | Category | Status | Notes |
|---|---|---|---|
| 1 | Anonymity & Privacy | ⚠️ | SEC-1/SEC-3 fixed. `/me` correctly returns phone/email for self only. Admin routes are role-gated. Push body contains user-authored intro (not phone/email — borderline acceptable). `hasPurpleTick` missing from moderation `anonymizeUser` (m1, minor). |
| 2 | Auth & Session Security | ⚠️ | HMAC refresh token fixed. CSPRNG OTP fixed. CORS allowlist fixed. Throttler global guard added. BANNED user OTP login gap (M3) still open. `verifyOtp` now checks BANNED — VERIFIED in code. Google sign-in also checks BANNED — verified. OTP page error copy conflation (M5) still open. |
| 3 | Payments | ⚠️ | Webhook HMAC-SHA256 verification correct + timing-safe compare present. `isDev()` is gated on `NODE_ENV=production` so simulate-success is blocked in prod. `simulate-success` endpoint exists but only callable when not prod. Razorpay plan IDs (`RAZORPAY_PLAN_BASIC/PRO/MAX`) NOT documented in `.env.prod.example` or compose — operators will ship with no subscription working. Amounts are plan-level (set in Razorpay dashboard) — not a paise math issue in code. |
| 4 | Moderation & Trust | ⚠️ | BAN correctly revokes tokens + push tokens + writes MentorDenylist. DISMISS now writes a ModerationActionLog row (Wave 5 M2 appears fixed in code). SUSPEND uses correct enum values (`SUSPEND_MENTOR`/`SUSPEND_ASPIRANT` added to schema). `listMentees` includes banned/suspended aspirants (m2). `anonymizeUser` missing `hasPurpleTick` (m1). |
| 5 | Real-time + Push | ⚠️ | Socket.IO Redis adapter gated behind `SOCKET_REDIS_ADAPTER=true` env — correct for horizontal scale. `DeviceNotRegistered` token cleanup present. Logout deletes push tokens (via BAN/SUSPEND). `EXPO_ACCESS_TOKEN` and `SOCKET_REDIS_ADAPTER` not in `.env.prod.example` or compose. Push notification body sends user-authored intro text (first 80 chars) — not PII fields, but carries user content. |
| 6 | Database | ✅ | Hot-path indexes present: `(conversationId, createdAt)` on Message, `(phone, createdAt)` on OtpRequest, `(userId, revokedAt)` on RefreshToken, `(mentorId, status)` and `(menteeId, status)` on ChatRequest. `User` has unique index on `phone`, `email`, `googleSub`. Migration strategy documented in DEPLOY.md — `db push` for first deploy then `migrate deploy` thereafter. N+1 exists in `listMentees` (2 queries per conversation inside `Promise.all`) — acceptable at MVP scale. Two named migrations in `prisma/migrations/` covering phases A-G. |
| 7 | Infrastructure | ✅ | Multi-stage Dockerfiles (non-root appuser + tini), healthchecks on all containers, correct boot order in compose (postgres+redis → api → web → caddy). Caddy auto-TLS + HSTS + security headers. Internal ports not exposed to host. `SOCKET_REDIS_ADAPTER` and `EXPO_ACCESS_TOKEN` missing from prod compose environment block. |
| 8 | Observability | ⚠️ | Sentry initialized on API (`main.ts`), web (`sentry.*.config.ts`), and mobile (`_layout.tsx`) — all three surfaces covered. PostHog autocapture off, capture_pageview off, explicit events only — PII-safe. Pino redact list covers phone, email, aadhaarHash, token fields. `console.error` in chat send path (`apps/web/app/(app)/chat/[id]/page.tsx:536`) leaks error detail to browser console. `console.log` in `apps/mobile/lib/push.ts` — low severity debug. |
| 9 | Testing | ⚠️ | 5 Vitest unit test files exist (auth, anonymity, tier guard, moderation, sessions). 34/40 API Playwright tests pass; 6 fail due to admin DB seed not run + 1 PUSH-5 spec gap. 44/66 desktop-chromium Playwright tests pass; 15 fail: 4 WCAG nested-interactive a11y (blocking), 2 chat tab count mismatch, 4 moderation (admin user seed), 2 payments locator strict-mode, 1 UI tour CTA ambiguity, 1 login placeholder, 1 onboarding heading structure. Mobile E2E: not run (no physical device in CI). |
| 10 | Documentation | ✅ | README quickstart complete and accurate. CLAUDE.md accurate. AGENT.md present. RUNBOOK.md covers day-to-day ops. DEPLOY.md covers first-deploy + updates + rollback + backups. SESSION.md present. ARCHITECTURE.md up to date. SECURITY.md accurately records findings and fix status. |
| 11 | UX & Accessibility | ❌ | WCAG 2.1A nested-interactive violation on all authenticated pages (axe `nested-interactive` rule). Chat tab count mismatch (3 rendered, 4 expected). Dashboard empty state has wrong copy ("admin will assign you a mentor" — contradicts the actual 160-char chat-request flow). `/journals` personal-category navigation functional bug (FB1) appears fixed in code (findFirst pattern). Mentor handle regeneration on promotion appears fixed (onboarding.service.ts:131). Dark mode supported (CSS `.dark` class + system-preference detection in layout). i18n scaffolded via `next-intl`. No privacy policy / TOS page. |
| 12 | Mobile | ⚠️ | All three apps typecheck clean (per Wave 5). Android E2E not run in CI. Push registration + logout cleanup wired. Google OAuth scaffolded. Sentry initialized. No WhatsApp-style archive tabs in mobile chat yet (Phase L deferred). |
| 13 | Performance / Scale | ⚠️ | k6 load tests scaffolded (onboarding, mentor discovery, chat history — 3 scenarios). Redis adapter for socket fanout present but opt-in. Single-region deploy acceptable for MVP. No scaling playbook documented (Wave 8 item per STATUS.md — flagged missing). Throttler: 30 req/s burst, 600 req/min, 10k req/hour per IP — reasonable for shared-NAT India. |
| 14 | Legal / Policy | ❌ | No privacy policy page. No Terms of Service page. No refund policy page. No footer with legal links on landing page. Play Store / App Store review will reject without these. PostHog autocapture off — cookie consent not strictly required but a banner is expected for Indian users. Aadhaar is hashed (hash of `userId:aadhaarLast4`), never stored plaintext. |
| 15 | Known deferred items | ✅ | Correctly deferred: coordinator dashboard, broadcast request feed, real 1:1 escrow, Aadhaar UIDAI/DigiLocker integration, voice/video, NLP PII detection. All flagged in STATUS.md. |

---

## Blockers (must fix before soft launch)

1. **WCAG nested-interactive violation on all authenticated pages** — axe `nested-interactive` rule fires on `.text-left` across `/dashboard`, `/journals`, `/chat`, `/mentors`. A `<button>` nested inside another interactive element. Fix the DOM nesting. 4 Playwright a11y tests fail; Play Store / App Store accessibility review may flag this. File: `apps/web/app/(app)/layout.tsx` or a shared component used there.

2. **No privacy policy / Terms of Service / Refund policy pages** — without these, mobile store submission will be rejected and Indian law (IT Act, Consumer Protection) is not satisfied. At minimum add placeholder pages at `/privacy`, `/terms`, `/refund` and link them from the landing page footer. File: new pages in `apps/web/app/`.

3. **`RAZORPAY_PLAN_BASIC`, `RAZORPAY_PLAN_PRO`, `RAZORPAY_PLAN_MAX` not in `.env.prod.example` or `docker-compose.prod.yml`** — operators deploying to production will have no Razorpay plan IDs set, causing every paid subscription checkout to throw `BadRequestException: Razorpay plan not configured for tier BASIC`. Fix: add the three variables to `.env.prod.example` and the `api` service environment block in `docker-compose.prod.yml`. File: `/root/Mento/.env.prod.example`, `/root/Mento/infra/docker/docker-compose.prod.yml`.

4. **`EXPO_ACCESS_TOKEN` and `SOCKET_REDIS_ADAPTER` missing from prod compose and env example** — `EXPO_ACCESS_TOKEN` is required for push notifications in production (without it the service logs to console and drops all push sends silently). `SOCKET_REDIS_ADAPTER=true` must be set for multi-instance horizontal scaling. Both are used in code but not declared in the prod infrastructure. File: `/root/Mento/.env.prod.example`, `/root/Mento/infra/docker/docker-compose.prod.yml`.

5. **Admin DB seed not run — moderation completely non-functional** — The bootstrap admin user (`+910000000000`) was created via OTP flow with `role=ASPIRANT`. All 5 API moderation tests and 4 browser moderation tests fail with 403. The fix is a one-time SQL `UPDATE "User" SET role = 'ADMIN' WHERE phone = '+910000000000'` or deleting the user and re-running `ADMIN_BOOTSTRAP_PHONE=+910000000000 pnpm db:seed`. This is an operational step that must be in the launch checklist. File: `apps/api/prisma/seed.ts`; operational step documented in `docs/DEPLOY.md` (step 2f) but must be enforced.

6. **M3: BANNED user can obtain a 15-minute access window via OTP verify** — The Wave 5 finding showed `verifyOtp` did not check BANNED. Code inspection of the current `auth.service.ts` shows the BANNED check IS present at line 108 and googleSignIn has it at line 80 — this appears fixed. However the OTP page (`apps/web/app/(auth)/otp/page.tsx`) error copy still conflates banned + 401 (M5). Verify the fix is deployed and update the frontend copy to show correct messaging for banned accounts. File: `apps/web/app/(auth)/otp/page.tsx:101-108`.

7. **Chat empty state wrong copy** — `/chat` shows "An admin will assign you a mentor or aspirant soon." This contradicts the actual product flow (mentees browse and send 160-char chat requests). This copy will confuse every new user on the most important page. Fix: "No conversations yet. Browse mentors to send your first intro." + CTA button to `/mentors`. File: `apps/web/app/(app)/chat/page.tsx`.

---

## High priority (should fix before promo spend, within 1 week)

1. **Chat tab count mismatch** — Playwright expects 4 `[role="tab"]` elements, only 3 rendered. Per spec §1.7, tabs are: Sent / Pending / Archived / Unanswered. One tab missing from the UI. File: `apps/web/app/(app)/chat/page.tsx`.

2. **`listMentees` returns banned/suspended aspirants** — Mentors see banned users in their mentee list. Fix: add `aspirant: { status: 'ACTIVE' }` to the `where` clause in `mentors.service.ts:listMentees`. File: `apps/api/src/modules/mentors/mentors.service.ts:68`.

3. **`anonymizeUser` in moderation service missing `hasPurpleTick`** — Verified mentors won't show the purple tick in the moderation queue. Fix: add `hasPurpleTick: user.profile?.hasPurpleTick ?? false` to the return object and to the frontend `ReportSummary` type. File: `apps/api/src/modules/moderation/moderation.service.ts:16`.

4. **`console.error` in chat send path** — `apps/web/app/(app)/chat/[id]/page.tsx:536` leaks internal error string to browser console. Replace with a toast or remove. File: `apps/web/app/(app)/chat/[id]/page.tsx:536`.

5. **Landing page: no footer, no trust signals, no value prop** — UX audit rates this a conversion killer for paid traffic. Priority items from UX audit: add a footer with Privacy / Terms / Refund / Contact links, add mentor count + aspirants-helped social proof, add a "How it works" 3-column band. File: `apps/web/app/page.tsx`.

6. **OTP page error conflation (M5)** — A plain HTTP 401 with any message other than "suspended" (e.g., "Account banned") hits `isSuspended = true` but falls through to show "Wrong code" copy. Fix the suspended/banned detection logic. File: `apps/web/app/(auth)/otp/page.tsx:101-108`.

7. **Razorpay plan IDs documented but env not wired** — see Blocker 3. Even if added to env example, operators must create the three plans in the Razorpay dashboard and set the IDs. Provide explicit provisioning instructions in `docs/DEPLOY.md`.

8. **MSG91 DLT template ID required for production OTP** — The `MSG91_TEMPLATE_ID` is required for actual SMS delivery. DLT registration in India takes 5-7 business days. This must be started immediately. Document in the pre-launch checklist.

9. **Load test not run against staging** — k6 scripts exist for 3 scenarios but no results documented. Must run before promo to know the single-server ceiling. File: `loadtest/k6/`.

10. **Mobile E2E not run in CI** — `mobile-android` row shows "not run" in E2E_SMOKE.md. At minimum run `cd apps/mobile && pnpm typecheck` in CI (already done); add a basic Expo export smoke test. File: `.github/workflows/ci.yml`.

---

## Medium priority (next sprint after launch)

1. **Google OAuth not provisioned** — Phase J is pending. 20-30% of Indian users will prefer Google sign-in. `GOOGLE_CLIENT_ID` in env example but not yet wired in a deployed credential.

2. **R2 / S3 bucket not wired** — Mentor credential uploads (hall ticket, Aadhaar) go nowhere in the current build. Phase F. Manual collection acceptable for first cohort but must scale.

3. **Mentor supply bootstrap** — First 10-20 verified mentors needed before launch. Admin verification queue (Phase F) must be manually operational even before automated upload is wired.

4. **`SaveToJournalDialog` double-402 handling (M4)** — Edge case where paywall modal fires but dialog also closes silently on race condition. File: `apps/web/app/(app)/chat/[id]/page.tsx:210-215`.

5. **Payments upgrade page strict-mode test failures** — `getByRole('button', { name: /basic/i })` resolves to 2 elements. Add `data-testid` attributes to fix locators. File: `apps/web/e2e/payments-flow.spec.ts`.

6. **Stale Playwright locators** — `ui-tour-extras.spec.ts` uses `/91987/i` placeholder which no longer matches the login form. Landing page onboarding test uses loose heading match. Fix locators or add `data-testid`. File: `apps/web/e2e/`.

7. **Dashboard "what's next" cards** — post-onboarding silence kills retention. Implement three cards: browse mentors, start journal, read reflections. File: `apps/web/app/(app)/dashboard/page.tsx`.

8. **No Framer Motion / skeleton loaders** — UX audit §X1/X2 rates this HIGH for B2C bar. ~2 days of work. Framer Motion is already in deps check; add to install if not.

9. **Segmented OTP input** — single text field vs 6-box UX is a conversion gap vs WhatsApp/Razorpay. File: `apps/web/app/(auth)/otp/page.tsx`.

10. **No scaling playbook documented** — `docs/STATUS.md` flags Wave 8 (load tests) as missing. Document: Redis adapter enable step, when to add a second API replica, Caddy sticky-session config for Socket.IO.

11. **JWT secret rotation policy not documented** — no runbook for rotating `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` without signing out all users. Add to `docs/RUNBOOK.md`.

---

## Known deferred (not blockers)

1. Coordinator dashboard (schema present; dashboard post-MVP per spec).
2. Broadcast mentor request feed (v1.1 per spec §1.11).
3. Real Razorpay escrow for 1:1 sessions (v1.1, August per spec §1.9).
4. Aadhaar UIDAI / DigiLocker verification provider (currently manual review).
5. Voice/video via 100ms (v1.1).
6. Deepgram transcription (v1.1).
7. NLP / regex automated PII detection (v1.1 per spec §1.16).
8. WhatsApp-style chat archive tabs in mobile (Phase L).
9. Long-press chat → journal sheet in mobile (Phase L).
10. Multi-language UI — i18n scaffolded (next-intl wired), English-only for MVP.
11. Real Expo push token auth via `EXPO_ACCESS_TOKEN` (token not yet provisioned).
12. ML mentor matching (post-PMF).
13. Peer-to-peer interview practice with AI (v1.2).

---

## Pre-launch checklist (operational)

### Infrastructure / secrets
- [ ] Set `ADMIN_BOOTSTRAP_PHONE` in `.env.prod` and run `docker exec mento-api-prod node dist/prisma/seed.js` — OR fix existing user role with `UPDATE "User" SET role = 'ADMIN' WHERE phone = '<phone>'`
- [ ] Generate strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (`openssl rand -hex 64` each)
- [ ] Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (live keys)
- [ ] Create Razorpay plans for BASIC (₹399/mo), PRO (₹599/mo), MAX (₹999/mo) and set `RAZORPAY_PLAN_BASIC`, `RAZORPAY_PLAN_PRO`, `RAZORPAY_PLAN_MAX` in `.env.prod`
- [ ] Add `RAZORPAY_PLAN_BASIC/PRO/MAX` to `.env.prod.example` and `docker-compose.prod.yml` api environment block
- [ ] Set `EXPO_ACCESS_TOKEN` in `.env.prod` and add to `docker-compose.prod.yml` api environment block
- [ ] Set `SOCKET_REDIS_ADAPTER=true` in `.env.prod` and add to `docker-compose.prod.yml` api environment block
- [ ] DNS A records pointed: `mento.in`, `www.mento.in`, `api.mento.in` → server IP
- [ ] SSL cert auto-issued by Caddy (verify with `dig mento.in` + `curl -I https://mento.in` after boot)
- [ ] Sentry DSN provisioned: set `SENTRY_DSN_API`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in `.env.prod` and GitHub Secrets
- [ ] PostHog project created: set `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_API_KEY` in `.env.prod`
- [ ] MSG91 DLT template registered and approved (5-7 business days lead time): set `MSG91_API_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_SENDER_ID`, `MSG91_ENABLED=true` (note: `.env.prod.example` uses `SMS_API_KEY` — reconcile variable name with what `otp.service.ts` reads, which is `MSG91_API_KEY`)
- [ ] Cloudflare R2 bucket created and `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL`, `S3_BUCKET` set in `.env.prod`
- [ ] `EXPO_PROJECT_ID` set in `.env.prod` for EAS push service
- [ ] Google OAuth client ID created in Google Cloud Console: set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- [ ] `POSTGRES_PASSWORD` and `REDIS_PASSWORD` set to strong random values (not defaults)

### Pre-launch verification
- [ ] Run `docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod config` — must exit 0 with no errors
- [ ] Run `docker compose ... up -d` and verify all 4 containers are healthy: `docker ps`
- [ ] `curl https://api.mento.in/healthz` → `{"status":"ok"}`
- [ ] `curl -I https://mento.in` → `HTTP/2 200`
- [ ] OTP flow end-to-end: request OTP → receive SMS on real device → verify → `/me` returns correct user
- [ ] Admin login: sign in as `ADMIN_BOOTSTRAP_PHONE` → access `/admin` → list users returns data
- [ ] Subscription checkout: sign in as aspirant → `/upgrade` → select PRO → Razorpay checkout page opens (live key)
- [ ] Razorpay webhook test: use Razorpay dashboard "Test webhook" to fire `subscription.activated` at `https://api.mento.in/subscriptions/webhook`
- [ ] Push notification test: register push token → trigger notification → receive on device
- [ ] File upload test: upload a test file via mentor onboarding credentials step → verify R2 object exists
- [ ] Sentry test: trigger a 500 error → verify it appears in Sentry dashboard within 60s
- [ ] PostHog test: complete onboarding → verify `onboarding.*` events appear in PostHog

### Legal / policy
- [ ] Privacy policy page live at `https://mento.in/privacy`
- [ ] Terms of Service page live at `https://mento.in/terms`
- [ ] Refund policy page live at `https://mento.in/refund` (required for Razorpay live key approval)
- [ ] Footer links to Privacy / Terms / Refund / Contact on landing page
- [ ] Play Store listing: privacy policy URL set
- [ ] App Store listing: privacy policy URL set

### Load and safety
- [ ] Run k6 load tests against staging before promo: `cd /root/Mento/loadtest/k6 && k6 run 01-onboarding.js`
- [ ] Verify Caddy rate-limit behaviour under k6 load (no 5xx storms)
- [ ] Backup cron configured on server: `/etc/cron.d/mento-backup` → `pg_dump` daily + sync to R2

### Content / mentor supply
- [ ] First cohort of 10-20 verified mentors onboarded and approved via admin queue before promo
- [ ] Founding mentor terms communicated (per open decision #1 in STATUS.md)
- [ ] Sample questions library seeded for beginner mentees (spec §1.13)

---

*Audit performed against commit on branch `main` as of 2026-05-13. Prior security findings SEC-1 through SEC-7 all addressed per code inspection. Open issues are the Wave 5 residuals (M1-M5 partial) plus new findings from this audit.*
