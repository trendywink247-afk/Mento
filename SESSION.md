# Mento — Session Checkpoint

> Last updated: 2026-05-13. Read this to pick up exactly where the last session ended.

## Where we are

**53 commits on `main` in `/root/Mento`.** MVP scope shipped end-to-end. Phase board:

- ✅ Phases 0-3 (foundation: bootstrap / auth / chat / admin)
- ✅ Phases A-D (spec alignment: schema+anonymity, onboarding, mentor discovery, journals)
- ✅ Phase E (Razorpay tiers + paywall)
- ✅ Phase G (moderation + ban + Aadhaar denylist)
- ✅ Phase H (1:1 sessions UI + simulated escrow)
- ✅ Phase J (Google OAuth + PostHog + Sentry)
- ✅ Phase L (chat→journal + WhatsApp archive tabs + My Mentees) — partial
- ✅ Push notifications (Expo Push)
- ✅ Production infra (Dockerfiles, Caddyfile, compose, CI sourcemaps)
- ✅ Test coverage (115 unit, 34/40 API e2e, 61/66 browser e2e)
- ⏳ Phase K — Broadcast mentor request (spec defers to v1.1)
- ⏳ Phase F — Mentor verification + R2 upload (admin can do manually for first cohort)
- ⏳ Coordinator dashboard (post-MVP)
- ⏳ Real Razorpay escrow (v1.1, August)

Last commit: `43805f6 fix: DISMISS short-circuit, seed admin promotion, PUSH-5 spec`

Start every new session by reading, in order:
1. `docs/STATUS.md` — live phase board with commit SHAs
2. `docs/CHANGELOG.md` — reverse-chronological human view of phases/waves
3. This file — resume notes
4. `AGENT.md` — subagent dispatch playbook + Wave naming convention
5. `CLAUDE.md` — project conventions (auto-loaded)

## Decisions already locked

Do NOT relitigate these without an explicit ask. Locked across sessions:

| Decision | Choice |
|---|---|
| Backend | NestJS + Prisma + TypeScript (Path B). Not re-platforming. |
| Real-time chat | Self-built Socket.IO + Redis adapter. |
| Web target | Desktop only, mobile UA hard-redirects to `/get-app`. |
| Mobile | Expo SDK 52 + Expo Router + NativeWind 4. |
| Auth | Custom JWT (15m + 30d refresh) + MSG91 OTP + Google OAuth. |
| Pricing | Tiered: FREE/BASIC/PRO/MAX (₹0/399/599/999 placeholders). |
| 1:1 sessions | UI in MVP, real Razorpay escrow in v1.1 (August). |
| Coordinator role | Schema in place, dashboard post-MVP. |
| Anonymity | Display handles + letter avatars (B/A/P/M/I/F), never phone/email in public. |
| Storage | Cloudflare R2 (S3-compat). Wiring pending in Phase F. |
| Aadhaar | Hash-only is the only Aadhaar form ever stored. Plaintext never persisted. |

## What's safe to do next

Pick from this list (none are blocking; everything below is deferred per spec):

1. **Phase F** — Mentor verification (R2 pre-signed URL + admin queue + Aadhaar denylist UI). Admin can promote/approve mentors manually for the first cohort.
2. **Phase K** — Broadcast request feed. Spec defers to v1.1.
3. **Coordinator dashboard** — Schema is there. Post-MVP.
4. **Real escrow** — Replace simulated WalletTransaction HOLD/CAPTURE/REFUND with actual Razorpay route_orders. v1.1.

Operational tasks always safe:
- Apply catch-up migrations on a fresh prod DB (see `docs/DEPLOY.md`)
- Run `pnpm --filter @mento/api db:seed` to promote an existing user to ADMIN (required for the 6 admin-only API e2e tests)
- Update docs (you are here)

## Agent dispatch pattern + Wave convention

We organize work into "Waves" — batches of 2-6 sub-agents dispatched in parallel via the Agent tool.

| Wave | Convention |
|---|---|
| Wave N (odd, e.g. 1, 3, 5, 7) | "Ship" — backend + frontend + mobile + tests in parallel |
| Wave N (even, e.g. 2, 4, 6) | "Ship + reviewer" — same as odd waves but a `reviewer` agent is spawned afterwards, fixes are made by a coder agent, then reviewer runs again until clean (max 7 iterations) |

History of waves so far:
- **Wave 1** — landing + dashboard + onboarding polish (`b3d7504` … `f0a44bd`)
- **Wave 2** — auto-formatter cleanup + linter pass (`05745e2` `9f09dfa`)
- **Wave 3** — mobile parity + Framer Motion + skeletons + dark mode + i18n + a11y (`c24aa44` … `13d40a1`)
- **Wave 4** — Phase E/H/J/G/L ship + reviewer (`3ac77ec` … `b4a3fa6`)
- **Wave 5** — Wave 4 reviewer follow-ups + e2e expansion (`e26ffba` `241086e`)
- **Wave 6** — prod infra + catch-up migration (`895ff13` `02ebbea`)
- **Wave 7** — Vitest unit tests + e2e failure triage + DISMISS bug fix (`d4590b9` `6618aa4` `d196a10` `43805f6`)
- **Wave 8** — this doc sync (no app code touched)

When dispatching a Wave:
- Always include a `reviewer` step after meaningful changes.
- Use `isolation: "worktree"` for code-writing agents; read-only agents (`Explore`, `reviewer`, `planner`) skip the worktree.
- Brief each agent with: goal, files to touch, acceptance criteria, what NOT to do, relevant spec section.
- Up to 6 agents in parallel per message.

See `AGENT.md` for the full playbook.

## Quick environment check

After restarting, verify the world is intact:

```bash
git -C /root/Mento log --oneline | head -10    # 53 commits
git -C /root/Mento status                       # working tree state
docker ps | grep mento                          # postgres + redis on :5433/:6380
cd /root/Mento/apps/api && pnpm typecheck       # should pass
cd /root/Mento/apps/web && pnpm typecheck       # should pass
cd /root/Mento/apps/mobile && pnpm typecheck    # should pass
cd /root/Mento/apps/api && pnpm test            # 115 unit tests
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

- **Shell cwd resets to `/root/GeekSpace2.0`** between Bash invocations. Always prepend `cd /root/Mento` or use absolute paths. Don't trust the "Shell cwd was reset to /root/Mento" reminder.
- **Local ports**: postgres 5433, redis 6380, web 3030 (not 3000), api 4000, expo 8081. Other ports are taken by GeekSpace2.0.
- **MSG91 disabled by default** in `.env.example` (`MSG91_ENABLED=false`). OTP codes print to api console AND return in API response (dev mode).
- **Admin bootstrap**: set `ADMIN_BOOTSTRAP_PHONE` in `.env` then run `pnpm --filter @mento/api db:seed`. Promotes existing user OR creates one.
- **NestJS is CommonJS**: NO `.js` extensions in `apps/api` imports. Other packages use bundler resolution.
- **Razorpay dev mode**: when `NEXT_PUBLIC_RAZORPAY_KEY_ID` is unset, `/upgrade` uses `simulate-success` directly (no checkout roundtrip).

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
- `docs/RUNBOOK.md` — common commands + troubleshooting
- `docs/DEPLOY.md` — production deploy guide
- `docs/ARCHITECTURE.md` — stack decisions
