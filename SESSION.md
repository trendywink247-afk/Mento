# Mento — Session Checkpoint

> Last updated: 2026-05-13. Read this to pick up exactly where the last session ended.

## What's in this branch

**71 commits on `main`. 100% of in-scope MVP is shipped.** Phase board:

- ✅ Phases 0-3 (foundation: bootstrap / auth / chat / admin)
- ✅ Phases A-D (spec alignment: schema+anonymity, onboarding, mentor discovery, journals)
- ✅ Phase E (Razorpay tiers + paywall)
- ✅ Phase G (moderation + ban + Aadhaar denylist)
- ✅ Phase H (1:1 sessions UI + simulated escrow)
- ✅ Phase J (Google OAuth + PostHog + Sentry)
- ✅ Phase L (chat→journal + WhatsApp archive tabs + My Mentees)
- ✅ Push notifications (Expo Push)
- ✅ Production infra (Dockerfiles, Caddyfile, compose, CI sourcemaps, BuildKit secret)
- ✅ Test coverage (127 Vitest unit, 40/40 API e2e, 66/66 browser e2e)
- ✅ Wave 11 — Admin analytics dashboard + feature flags + beta invite codes
- ✅ Wave 12 — Onboarding nudges, perf indexes, SEO/OG, hygiene
- ✅ Wave 13 — EAS mobile build pipeline + PostHog event taxonomy (40 events)
- ⏳ Phase K — Broadcast mentor request (spec defers to v1.1)
- ⏳ Phase F — Mentor verification + R2 upload (admin can do manually for first cohort)
- ⏳ Coordinator dashboard (post-MVP per spec)
- ⏳ Real Razorpay escrow (v1.1, August)

Latest commit: `da593bc fix: Wave 12 reviewer criticals — schedule dep, robots.txt route groups`

Start every new session by reading, in order:
1. `docs/STATUS.md` — live phase board with commit SHAs
2. `docs/CHANGELOG.md` — reverse-chronological human view of phases/waves
3. This file — resume notes
4. `AGENT.md` — subagent dispatch playbook + Wave naming convention
5. `CLAUDE.md` — project conventions (auto-loaded)

For the release audit see `docs/RELEASE_READINESS.md`.

## Decisions already locked

Do NOT relitigate these without an explicit ask. Locked across sessions:

| Decision | Choice |
|---|---|
| Backend | NestJS + Prisma + TypeScript (Path B). Not re-platforming. |
| Real-time chat | Self-built Socket.IO + Redis adapter (gated by `SOCKET_REDIS_ADAPTER`). |
| Web target | Desktop only, mobile UA hard-redirects to `/get-app`. |
| Mobile | Expo SDK 52 + Expo Router + NativeWind 4. EAS for store builds. |
| Auth | Custom JWT (15m + 30d refresh) + MSG91 OTP + Google OAuth. |
| Pricing | Tiered: FREE/BASIC/PRO/MAX (₹0/399/599/999 placeholders). |
| 1:1 sessions | UI in MVP, real Razorpay escrow in v1.1 (August). |
| Coordinator role | Schema in place, dashboard post-MVP. |
| Anonymity | Display handles + letter avatars (B/A/P/M/I/F), never phone/email in public. |
| Storage | Cloudflare R2 (S3-compat). Wiring pending in Phase F. |
| Aadhaar | Hash-only is the only Aadhaar form ever stored. Plaintext never persisted. |
| Analytics | PostHog autocapture OFF — explicit `capture()` only. UUID identify; never PII in props. |
| Feature flags | Server-driven (`/flags` public + `/admin/flags`). 60s web/mobile poll. |

## What's safe to do next

Everything below is deferred per spec — pick whatever you want to tackle first:

1. **Phase F** — Mentor verification (R2 pre-signed URL + admin queue + Aadhaar denylist UI).
2. **Phase K** — Broadcast request feed (v1.1).
3. **Coordinator dashboard** — schema is there. Post-MVP.
4. **Real escrow** — Replace simulated WalletTransaction with actual Razorpay route_orders. v1.1.

Operational tasks always safe:
- Apply catch-up + perf-indexes migrations on a fresh prod DB (see `docs/DEPLOY.md`)
- `pnpm --filter @mento/api db:seed` to promote `ADMIN_BOOTSTRAP_PHONE` to ADMIN
- `curl -X POST .../admin/flags/seed` (admin token) to seed feature-flag defaults after first deploy

## Agent dispatch pattern + Wave convention

We organize work into "Waves" — batches of 2-6 sub-agents dispatched in parallel via the Agent tool.

| Wave | Convention |
|---|---|
| Wave N (odd) | "Ship" — backend + frontend + mobile + tests in parallel |
| Wave N (even) | "Ship + reviewer" — same as odd plus reviewer loop until clean (max 7 iterations) |

History of waves so far:
- **Wave 1** — landing + dashboard + onboarding polish
- **Wave 2** — auto-formatter cleanup
- **Wave 3** — mobile parity + Framer Motion + skeletons + dark mode + i18n + a11y
- **Wave 4** — Phase E/H/J/G/L ship + reviewer
- **Wave 5** — Wave 4 reviewer follow-ups + e2e expansion
- **Wave 6** — prod infra + catch-up migration
- **Wave 7** — Vitest unit tests + e2e triage + DISMISS bug fix
- **Wave 8** — release-blocker batch (env rename, legal pages, k6, doc sync)
- **Wave 9** — DB enum sync, mobile load() fix, .npmrc + .dockerignore + typography
- **Wave 10** — full e2e validation (all green)
- **Wave 11** — admin analytics + feature flags + beta invite codes
- **Wave 12** — nudges + hygiene + perf indexes + SEO/OG + module-registration fixes
- **Wave 13** — EAS pipeline + PostHog taxonomy + Wave 12 review fixes

See `AGENT.md` for the full playbook.

## Quickly verify the stack is healthy

After restarting, verify the world is intact:

```bash
git -C /root/Mento log --oneline | head -10              # 71 commits
git -C /root/Mento status                                 # working tree state
docker ps | grep mento                                    # postgres + redis on :5433/:6380
cd /root/Mento/apps/api && pnpm typecheck                 # PASS
cd /root/Mento/apps/web && pnpm typecheck                 # PASS
cd /root/Mento/apps/mobile && pnpm typecheck              # PASS
cd /root/Mento/apps/api && pnpm test                      # 127 unit tests
cd /root/Mento/apps/web && pnpm test:e2e                  # 40 API + 66 browser (requires dev stack)
cd /root/Mento/apps/web && pnpm build                     # 39 routes
```

If postgres/redis aren't running:

```bash
docker compose -f /root/Mento/infra/docker/docker-compose.local.yml up -d
```

If schema looks out of sync after a hand-edit (dev only):

```bash
cd /root/Mento/apps/api && pnpm prisma db push --accept-data-loss
```

For prod baseline migration workflow see `docs/DEPLOY.md`.

## Known gotchas (carried over)

- **Shell cwd resets to `/root/GeekSpace2.0`** between Bash invocations. Always prepend `cd /root/Mento` or use absolute paths.
- **Local ports**: postgres 5433, redis 6380, web 3030, api 4000, expo 8081.
- **MSG91 disabled by default** in `.env.example` (`MSG91_ENABLED=false`). OTP prints to api console.
- **Admin bootstrap**: set `ADMIN_BOOTSTRAP_PHONE` in `.env` then `pnpm --filter @mento/api db:seed`.
- **NestJS is CommonJS**: NO `.js` extensions in `apps/api` imports.
- **Razorpay dev mode**: when `NEXT_PUBLIC_RAZORPAY_KEY_ID` is unset, `/upgrade` uses `simulate-success` directly.
- **Nudges**: `NUDGES_ENABLED=false` disables the `@nestjs/schedule` crons (mirror nudge 6h, mentor nudge 12h). Enable in prod.
- **Beta gating**: `BETA_INVITE_REQUIRED=true` forces invite-code redemption on first sign-in. Default is false.
- **Feature flags**: must be seeded after first prod deploy via `POST /admin/flags/seed` (admin token). Defaults: `chat-search: true`, others `false`.

## What to do when you sit back down

1. Open a terminal at `/root/Mento`.
2. Run the quick environment check above.
3. Start `claude`.
4. Tell me what slice you want (Phase F, Phase K, coordinator, real escrow, or "polish X").
5. I'll read STATUS.md + CHANGELOG.md + the relevant spec section and pick up.

## Files maintained by this doc system

- `README.md` — entry doc + quickstart
- `CLAUDE.md` — Claude Code instructions (auto-loaded)
- `AGENT.md` — sub-agent delegation guide + Wave conventions
- `SESSION.md` — this file (resume notes)
- `docs/STATUS.md` — live phase board
- `docs/CHANGELOG.md` — reverse-chronological commit history
- `docs/RELEASE_READINESS.md` — release audit + pre-launch checklist
- `docs/RUNBOOK.md` — common commands + troubleshooting
- `docs/DEPLOY.md` — production deploy guide
- `docs/ARCHITECTURE.md` — stack decisions
- `docs/ANALYTICS_EVENTS.md` — PostHog event taxonomy (40 events)
