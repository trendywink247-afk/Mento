# Mento — Product One-Pager

> For investors, advisors, and new collaborators. Last updated: 2026-05-13.

---

## What it is

Mento is an anonymous, peer-led UPSC mentorship platform connecting aspirants with people who have already walked the same path — including those who *almost* cleared. The product is WhatsApp-simple by design: no ratings on humans, no real names in feeds, no friction between an aspirant who needs guidance and a mentor who can give it. The long-term ambition is 10 M MAU across India's 1.5 M active UPSC aspirants plus the much larger pool of aspirants at every competitive exam.

---

## What's in the box

| Feature | Detail |
|---|---|
| **Anonymous identity** | Every user gets a display handle (`Aspirant_8421`, `Mentor_0371`) and a letter avatar (B/A/P/M/I/F, color-coded). Phone and email are never surfaced in any public response. `hasPurpleTick` marks Aadhaar-verified mentors. |
| **Three roles** | Admin (web), Mentor, Aspirant. Coordinator schema is in place; dashboard deferred post-MVP per spec. |
| **Mirror onboarding** | 12-screen aspirant journey wizard that maps to six UPSC journey stages; 4-step mentor wizard that auto-promotes the account. All copy verbatim from spec. |
| **Mentor discovery** | Filterable list (journey type, stage, availability) + full mentor profile with timeline, metrics, and written reviews. No star ratings on humans. |
| **160-char chat request** | Aspirants initiate with a 160-character intro (rate-limited: 30/day). Mentors accept, decline, or archive. |
| **WhatsApp-style chat** | Self-built Socket.IO gateway (7 events). Typing indicators, read receipts, message status. Archive tabs (All / Active / Archived) with badge counts, in-thread search, swipe-to-archive on mobile. |
| **Chat-to-journal** | Long-press a message to save it directly to the aspirant's journal (PRO tier). |
| **Tiered subscriptions** | FREE / BASIC / PRO / MAX. Placeholder prices ₹399 / ₹599 / ₹999 — validate during user testing. Real Razorpay HMAC-SHA256 webhooks. Dev simulate-success flow (no key needed locally). `TierGuard` enforces feature gates server-side. |
| **1:1 session booking** | Availability grid + booking sheet UI. Simulated HOLD → CAPTURE → REFUND escrow wallet. Real Razorpay escrow deferred to v1.1 (August). |
| **Journals** | 17 categories: Personal, 8 Prelims subjects (Polity, History, Geography, Economy, Environment, Sci-Tech, CSAT, Current Affairs), 6 Mains papers (GS1-GS4, Essay, Optional), Interview, Shared-with-mentor. Presence-gated shared editing. Full audit log (CREATE / EDIT / APPEND / DELETE / LOCK / UNLOCK). Auto-lock on archive. |
| **Moderation** | Report queue with 5-message author context. Actions: DISMISS / WARN / SUSPEND / BAN. BAN writes Aadhaar hash to denylist; SUSPEND/BAN revokes all refresh tokens and deletes push tokens. Banned users rejected at OTP-verify and Google sign-in. |
| **Push notifications** | Expo Push batched at 100/request. Offline message alerts, chat request alerts, onboarding nudges. DeviceNotRegistered auto-cleanup. |
| **Feature flags** | Server-driven flag system (schema + API + web + mobile). Admin toggle at `/admin/flags`. |
| **Beta invite codes** | Scoped invite codes with use-count limits, managed at `/admin/invites`. |
| **Onboarding nudges** | Mirror and mentor completion push reminders for users who abandon onboarding mid-flow. |
| **Analytics dashboard** | Founder-facing `/admin/analytics`: daily signups, daily messages, tier distribution, funnel events (signup → role pick → onboarding complete → first chat → upgrade). PostHog event capture across all three surfaces. |
| **Admin console** | `/admin/analytics`, `/admin/flags`, `/admin/invites`, `/admin/moderation`, `/admin/users`, `/admin/assignments`, `/admin/audit`. |

---

## Production status

| Item | Status |
|---|---|
| Docker images build clean (api + web) | Yes — 3-stage builds, non-root user, tini, healthcheck |
| Prod compose validates | Yes — `docker compose config` passes with no errors |
| Caddy reverse proxy | Configured — auto-TLS for `mento.in` + `api.mento.in`, HSTS, gzip+zstd |
| Deploy workflow | Scaffolded — GitHub Actions CI builds + pushes to GHCR on `v*` tags; SSH deploy step documented |
| Database migration strategy | `db push` for first prod deploy → `migrate resolve` to mark baseline → `migrate deploy` for all future releases |
| k6 load test baseline | Measured — 5 scenarios (onboarding, mentor discovery, chat history, mixed realistic); SLO targets documented |
| Sentry sourcemaps | CI uploads to Sentry on every tagged build (api + web + mobile surfaces) |
| EAS mobile build pipeline | Configured — development / preview / production profiles; OTA update channel wired |

---

## What's deferred (per-spec, not forgotten)

| Item | Reason |
|---|---|
| Coordinator dashboard | Schema in place; dashboard deferred post-MVP per spec |
| Broadcast mentor request feed (Phase K) | Spec defers to v1.1 |
| Real 1:1 session escrow (Razorpay) | v1.1 (August) per spec |
| Mentor document upload (Phase F — R2 pre-signed URLs) | Admin can manually verify first cohort; low urgency at launch |
| Aadhaar UIDAI / DigiLocker integration | Deferred; current flow stores hash of `userId:aadhaarLast4` only |

---

## Open items before paid launch

The go/no-go audit (`docs/RELEASE_READINESS.md`) now rates the platform **GREEN**. All seven Wave-8 code blockers have been resolved across Waves 9–15. What remains is operator-side credential provisioning before the first paid push:

1. **Razorpay live keys + plan IDs** — register on Razorpay dashboard, drop into `.env.prod`
2. **MSG91 DLT** registration — 5–7 day lead time for the OTP template approval
3. **Sentry DSN + auth token + org/project slug** — create the project at sentry.io
4. **Google OAuth client ID + secret** — Google Cloud Console, add `https://api.mento.in/auth/google/callback` as a redirect URI
5. **Cloudflare R2 bucket** + access keys for verification document uploads
6. **EAS account** + Apple App Store Connect API key + Google Play service account JSON for mobile submissions
7. **DNS** pointed at the prod server, then Caddy auto-issues TLS

---

## First-day operator checklist

1. Read **[docs/DEPLOY.md](./DEPLOY.md)** end to end before touching the server.
2. Fill every variable in `.env.prod` from `.env.prod.example`.
3. Run `docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod config` — must print clean YAML.
4. First deploy: `db push` + `migrate resolve` (baseline), then `migrate deploy` for every update.
5. Seed admin: `docker exec mento-api-prod node dist/prisma/seed.js` (needs `ADMIN_BOOTSTRAP_PHONE`).
6. Verify: `curl https://api.mento.in/healthz` returns `{"status":"ok"}`.
7. Mobile: follow `docs/DEPLOY.md §9` for EAS account setup, secrets, and first store build.
8. Read **[docs/RUNBOOK.md](./RUNBOOK.md)** for day-to-day ops, log access, and troubleshooting.
9. Check **[docs/RELEASE_READINESS.md](./RELEASE_READINESS.md)** go/no-go matrix before any paid promotion.

---

## Tech stack at a glance

| Layer | Technology |
|---|---|
| Monorepo | pnpm + Turborepo |
| API | NestJS + TypeScript + Prisma ORM |
| Database | Postgres 16 |
| Cache / pub-sub | Redis 7 |
| Real-time chat | Self-built Socket.IO (Redis adapter for horizontal scale) |
| Web | Next.js 15 App Router — desktop only |
| Mobile | Expo SDK 52 + Expo Router + NativeWind 4 (iOS + Android) |
| Auth | Custom JWT (15m access + 30d refresh + rotation) + MSG91 OTP + Google OAuth |
| Payments | Razorpay (HMAC-SHA256 webhook verification) |
| Push | Expo Push (batched, with DeviceNotRegistered cleanup) |
| Storage | Cloudflare R2 (S3-compatible; wiring pending) |
| Analytics | PostHog (explicit events, no autocapture) |
| Error tracking | Sentry (web + api + mobile, sourcemaps via CI) |
| Reverse proxy | Caddy (auto-TLS, HSTS, gzip+zstd, HTTP/3 ready) |
| Mobile CI | EAS build pipeline + EAS Update (OTA) |
| Load testing | k6 (5 scenarios, SLO targets documented) |
| Tests | Vitest (142 unit) + Playwright (40 API e2e, 66 browser e2e, axe a11y) + k6 (5 perf scenarios) |
