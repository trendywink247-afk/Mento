# Mento — Session Checkpoint

> Last updated: 2026-05-11. Read this to pick up exactly where the last session ended.

## Where we are

**9 commits on `main` in `/root/Mento`.** Phases 0-3 (foundation) + Phases A-D (spec alignment) are shipped. All 3 apps typecheck clean. Schema is applied to local Postgres on `:5433`. Auth flow verified end-to-end via curl in the last session.

## Decisions already locked

Do NOT relitigate these without an explicit ask. Locked across this and previous sessions:

| Decision | Choice | Why |
|---|---|---|
| Backend | **NestJS + Prisma + TypeScript** (Path B) | Not re-platforming to FastAPI. Python sidecar later if needed for ML. |
| Real-time chat | **Self-built Socket.IO + Redis adapter** | Owned data, no per-MAU cost. |
| Web target | **Desktop only**, mobile UA hard-redirects to `/get-app` | Spec section 1.14 |
| Mobile | **Expo SDK 52 + Expo Router + NativeWind 4** | iOS + Android + Web target for dev |
| Auth | **Custom JWT (15m + 30d refresh) + MSG91 OTP** | India-first, no vendor lock-in. Google OAuth pending. |
| Pricing | **Tiered: FREE/BASIC/PRO/MAX** (₹0/399/599/999 placeholders) | Spec section 1.12 — validate during testing |
| 1:1 sessions | **UI in MVP, real Razorpay escrow in v1.1 (August)** | Spec section 1.9 |
| Coordinator role | **Schema in place, dashboard post-MVP** | Spec section 1.20 |
| Anonymity | **Display handles + letter avatars (B/A/P/M/I/F)**, never phone/email in public responses | Non-negotiable |
| Storage | **Cloudflare R2** (S3-compat, zero egress) | Not DigitalOcean Spaces |

## Phase board

| Phase | What | Status | Commit |
|---|---|---|---|
| 0 | Monorepo bootstrap + 3 apps + packages + local infra | ✅ | `2ca9ebe` |
| 1 | Auth (OTP + JWT + refresh rotation + RBAC) | ✅ | `822d7d1` |
| 2 | Chat (Socket.IO + REST + assignments) | ✅ | `f9bda40` |
| 3 | Admin module (users, assignments, audit log) | ✅ | `9ca2552` |
| — | Redis adapter env-gate | ✅ | `a18ee50` |
| **A** | Spec-aligned schema (30+ models) + anonymity layer | ✅ | `28d0939` |
| **B** | Pre-auth role pick + 12-screen Mirror + mentor onboarding | ✅ | `6ed2611` |
| **C** | Mentor discovery + 160-char chat request | ✅ | `02f9124` |
| **D** | Journals (categories + shared presence gating + audit log) | ✅ | `4415b14` |
| E | Razorpay tiers (Basic/Pro/Max) + paywall | ⏳ next | — |
| F | Mentor verification (R2 upload + admin queue + Aadhaar denylist) | ⏳ | — |
| G | Report + moderation queue + ban policy | ⏳ | — |
| H | 1:1 booking UI (stubbed payment) | ⏳ | — |
| I | UX polish (Lottie + Reanimated + Moti + haptics + states) | ⏳ HIGH | — |
| J | Google OAuth + PostHog SDK + Sentry init | ⏳ | — |
| K | Broadcast mentor request feed | ⏳ (spec defers to v1.1) | — |
| L | Long-press chat→journal UI + WhatsApp archive tabs | ⏳ | — |

## Recommended next slice

Phase **E** (Razorpay tiers + paywall). Day-1 monetisation. ~10 files. After E, prioritize:
1. **G** (moderation) — safety on launch
2. **I** (UX polish) — critical for the 1M-MAU bar
3. **F** (mentor verification)

## Resume the conversation in a new terminal

The previous Claude Code session ID was:

```
2ade85a9-4f26-49b6-9ade-c3a7c5ea4740   # original (pre-/btw branch)
9eea8be3-a845-43f9-8266-574abe7cde55   # current branch (where Phases A-D happened)
```

To resume **this** session (the one with the full architecture + Phase A-D context):

```bash
claude --resume 9eea8be3-a845-43f9-8266-574abe7cde55
```

If `--resume` shows a picker, pick the entry tagged with `Mento` and the most recent activity.

To **start fresh** with full project context (CLAUDE.md auto-loads):

```bash
cd /root/Mento
claude
```

CLAUDE.md, AGENT.md, README.md, and this SESSION.md will all be discoverable. Then say:

> "Read SESSION.md and docs/STATUS.md, then continue with Phase E."

## Quick environment check

After restarting, run these to verify the world is intact:

```bash
git -C /root/Mento log --oneline | head -10    # should show 9 commits
git -C /root/Mento status                       # should be clean
docker ps | grep mento                          # postgres + redis containers
cd /root/Mento/apps/api && pnpm typecheck       # should pass
cd /root/Mento/apps/web && pnpm typecheck       # should pass
cd /root/Mento/apps/mobile && pnpm typecheck    # should pass
```

If postgres/redis aren't running:

```bash
docker compose -f /root/Mento/infra/docker/docker-compose.local.yml up -d
```

If schema looks out of sync (after a hand-edit):

```bash
cd /root/Mento/apps/api && pnpm prisma db push --accept-data-loss
```

## Known gotchas (carried over)

- **Shell cwd resets to `/root/GeekSpace2.0`** between Bash invocations. Always prepend `cd /root/Mento` or use absolute paths. Don't trust the "Shell cwd was reset to /root/Mento" reminder — the next command still starts in GeekSpace2.0.
- **Local ports**: postgres 5433, redis 6380, web 3030 (not 3000), api 4000, expo 8081. Other ports are taken by GeekSpace2.0 containers on this host.
- **MSG91 disabled by default** in `.env.example` (`MSG91_ENABLED=false`). OTP codes print to api console AND return in API response (dev mode).
- **Admin bootstrap**: set `ADMIN_BOOTSTRAP_PHONE` in `.env` then run `pnpm --filter @mento/api db:seed`. That phone, when it logs in via OTP, gets `role=ADMIN`.

## What to do when you sit back down

1. Open a terminal at `/root/Mento`.
2. Run the quick environment check above.
3. Start `claude` (or `claude --resume <id>`).
4. Tell me: "Continue Phase E: Razorpay tiers + paywall" (or whichever phase you want next).
5. I'll read `SESSION.md` + `docs/STATUS.md` + the relevant spec section and pick up.

## Files you wanted to add this session

- ✅ `README.md` — entry doc
- ✅ `CLAUDE.md` — Claude Code instructions (auto-loaded)
- ✅ `AGENT.md` — sub-agent delegation guide
- ✅ `SESSION.md` — this file
- ✅ `docs/STATUS.md` — live phase board
- ✅ `docs/RUNBOOK.md` — common commands + troubleshooting
- ✅ Updated `/root/.claude/plans/eventual-nibbling-token.md` — current plan reflecting Path B
