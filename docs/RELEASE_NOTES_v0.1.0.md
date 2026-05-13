# Mento v0.1.0 — First Public Release

> Released: 2026-05-13. The MVP described in `docs/Requirement.md` is feature-complete.

## TL;DR
- 86 commits on `main`, 18 waves of ship → audit → fix
- 142 Vitest unit + 32 Playwright API e2e + 118 Playwright browser e2e (all green)
- Docker images build clean (api 433 MB), prod compose validates with PgBouncer
- All anonymity invariants enforced; 11 reviewer-found ship-killers caught + fixed across audits

## Highlights for users (Aspirants and Mentors)
- Anonymous identity (letter avatars; no real names or photos)
- 12-screen Mirror onboarding for self-assessment
- Mentor discovery + 160-char chat-request flow
- WhatsApp-style chat with archive + in-thread search
- Tier subscriptions (FREE / BASIC / PRO / MAX) — real Razorpay in prod, dev simulate-success locally
- Journals (17 categories) with presence-gated sharing + full audit log
- 1:1 session booking UI (simulated escrow; real escrow v1.1)
- Push notifications via Expo Push
- Privacy / Terms / Refund pages (legal-review pending)

## Highlights for operators (Admin)
- `/admin/moderation` — report queue + DISMISS / WARN / SUSPEND / BAN
- `/admin/analytics` — counts + funnel + MRR + moderation health
- `/admin/flags` — feature flag toggles with live propagation
- `/admin/invites` — beta invite codes with race-safe redemption
- `/admin/users/[id]` — admin-only access to phone/email
- Sentry, PostHog, Prometheus `/metrics` integration
- Postgres backup + restore scripts (`scripts/backup-pg.sh`, `scripts/restore-pg.sh`)
- k6 load test suite (5 scenarios; mentor list P95 = 7.5 ms)

## Architecture decisions locked
- NestJS + Prisma + Postgres + Redis
- Self-built Socket.IO (no Stream) with Redis adapter for horizontal scale
- PgBouncer transaction-mode pooling (`DEFAULT_POOL_SIZE=25`)
- Next.js 15 App Router (desktop-only — mobile UA hard-redirects to `/get-app`)
- Expo SDK 52 + Expo Router + NativeWind 4
- Custom JWT (15m access + 30d refresh + rotation + theft detection)
- MSG91 OTP + Google OAuth ID-token verify
- Razorpay (HMAC-SHA256 webhook verification)
- Caddy reverse proxy (auto-TLS, HSTS, full security headers)
- BuildKit secret mount for Sentry token (never in image layers)

## Deferred to v1.1 (per spec)
- Broadcast mentor-request feed
- Real session escrow (currently simulated)
- Coordinator dashboard (schema present, UI deferred)

## Operator action required before paid launch
1. Razorpay live keys + plan IDs (BASIC / PRO / MAX)
2. MSG91 DLT template registration (5-7 day lead time)
3. Sentry DSN + auth token + org/project slug
4. Google OAuth client ID + secret
5. Cloudflare R2 bucket + access keys
6. EAS account + Apple ASC API key + Google Play service account
7. DNS pointed at prod server (Caddy auto-issues TLS)
8. Run `scripts/backup-pg.sh` on first cron schedule

## Known issues
- 2.5 GB k6 crash-output blob in git history at `9f645a1` — recommend `git filter-repo` before pushing to any remote
- Loadtest result files still git-tracked — gitignore in place going forward

## Acknowledgements
13 phases + 16 waves of audit, ship, and fix. Reviewer rounds caught 9 critical ship-killers that would have shipped silent failures. See `docs/REVIEW_WAVE*.md` for the full audit trail.

## Where to read more
- `README.md` — quickstart
- `docs/Requirement.md` — full product spec
- `docs/STATUS.md` — phase board
- `docs/CHANGELOG.md` — commit-level history
- `docs/FOUNDER.md` — one-pager
- `docs/DEPLOY.md` — production deployment
- `docs/RUNBOOK.md` — day-to-day ops
- `docs/RELEASE_READINESS.md` — go/no-go matrix
- `docs/SECURITY.md` — anonymity + auth + moderation contracts
- `docs/ANALYTICS_EVENTS.md` — PostHog event taxonomy
- `docs/ALERTING.md` — Sentry + Prometheus rule examples
- `loadtest/SCALING_PLAYBOOK.md` — capacity planning
