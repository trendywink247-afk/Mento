# Mento — Sub-Agent Delegation Guide

> Read after `CLAUDE.md`. Use when delegating work via the `Agent` tool. Last updated 2026-05-13.

## When to delegate

| Situation | Action |
|---|---|
| Independent slices that can run in parallel (e.g., add a backend module **and** the frontend page that consumes it) | Dispatch 2-6 agents in parallel via a single message with multiple `Agent` tool calls |
| Codebase question spanning many files ("where is X used?") | Spawn `Explore` agent |
| After any meaningful change | Run `reviewer` agent |
| Targeted lookup (one file, known path) | Just `Read` directly. Don't spawn an agent. |
| Writing tests | `tester` agent (Vitest + Playwright) |
| Infra / Docker / CI / Caddy | `infra` agent |
| Backend (NestJS, Prisma) | `backend` agent |
| Frontend (Next.js / Expo) UI | `frontend` or `coder` agent |
| Stripe / Razorpay / MSG91 / OAuth | `billing` agent |
| LLM / AI features | `llm-agent` |
| Designing UI / design tokens / Figma | `designer` |

## Dispatch policy

- **Parallel up to 6 agents** when tasks are truly independent.
- **All sub-agents use `model: sonnet`** by default. Do not override.
- **Worktree isolation** (`isolation: "worktree"`) for code-writing agents. Read-only agents (`planner`, `reviewer`, `Explore`) don't need worktrees.
- **Briefing is mandatory.** Sub-agents have ZERO context from the parent conversation. Every prompt must include: what to do, which files to touch, acceptance criteria, what NOT to do, the relevant section of `docs/Requirement.md`.

## Wave convention

We organize work into numbered Waves. Each Wave is a single batch of 2-6 parallel agents addressing a coherent slice.

| Parity | Pattern | When to use |
|---|---|---|
| Odd Wave (1, 3, 5, 7…) | "Ship" — coder agents only | Initial implementation of a slice |
| Even Wave (2, 4, 6, 8…) | "Ship + reviewer" — code agents PLUS a `reviewer` agent | Follow-up reviewer loop; or new slices where a review is mandatory |

History so far (informational — your numbering will continue):
- Wave 1 — landing + dashboard + onboarding polish
- Wave 2 — auto-formatter cleanup
- Wave 3 — mobile parity + animations + skeletons + dark mode + i18n + a11y
- Wave 4 — Phases E/H/J/G/L ship + reviewer
- Wave 5 — Wave 4 reviewer follow-ups + e2e expansion
- Wave 6 — production infra + catch-up migration
- Wave 7 — Vitest unit tests + e2e failure triage + DISMISS bug fix

Pick the next free wave number. Tag commits with the wave (`Wave 4 reviewer findings`, etc.).

## Briefing template

```
## Goal
<1-2 sentences>

## Context (sub-agent has no prior context)
- Project: Mento (UPSC mentorship). Stack: NestJS + Prisma + Next.js + Expo + Socket.IO + Redis.
- Spec section: docs/Requirement.md §<section number>
- Anonymity is non-negotiable: no phone/email in public responses, use displayHandle + letterAvatar.

## Files to touch
- apps/api/src/modules/<...>
- apps/web/app/(app)/<...>
- packages/types/src/index.ts (only if new shared types needed)

## Acceptance criteria
1. ...
2. typecheck passes: `cd apps/api && pnpm typecheck`
3. <feature> works end-to-end via curl/UI

## Do NOT
- Re-platform the backend
- Expose phone/email in API responses
- Write fresh copy — pull from lib/copy.ts
- Add `.js` extensions in api imports (CommonJS)
- Commit without running typecheck per-app
```

## Review loop convention

After a Wave of coding agents finishes:

1. Spawn `reviewer` with the diff and a checklist (anonymity, typecheck, copy, spec alignment, regressions, build, a11y).
2. Reviewer writes findings to `docs/REVIEW_WAVE<N>.md` (CRITICAL / MAJOR / MINOR severities).
3. If reviewer reports issues → spawn the appropriate coding agent with the fix list (briefing template above), committed as `fix: Wave N reviewer findings — ...`.
4. Re-spawn `reviewer` to verify.
5. Repeat until clean OR 7 iterations max.

`/double-check` shorthand = one review pass.

## When to use Plan + worktree isolation

- Multi-file refactors with cross-package implications → write a plan first (`/root/.claude/plans/<name>.md`) using the `planner` agent, then dispatch executor agents against the plan.
- Risky migrations or schema changes → worktree isolation lets you abandon a branch without polluting `main`.
- Read-only investigations (`reviewer`, `Explore`, `planner`) → no worktree; they don't write to disk.

## Examples

### Parallel: backend module + UI

```
Agent({ subagent_type: "backend", isolation: "worktree", prompt: "..." })
Agent({ subagent_type: "frontend", isolation: "worktree", prompt: "..." })
```

Send both in a single message with two tool calls. They merge changes back into main when done.

### Investigate before changing

```
Agent({ subagent_type: "Explore", prompt: "Find every place a phone number is returned in any API response and list the file/line/route. Quick scan." })
```

### Validate before committing

```
Agent({ subagent_type: "reviewer", prompt: "Review the diff on HEAD. Check: (1) no `phone` or `email` in non-admin responses, (2) typecheck clean per-app, (3) copy strings imported from lib/copy.ts, (4) Prisma schema changes have a corresponding migration." })
```

## Don't delegate

- One-line edits (just do them).
- Reading a single known file.
- Re-running typecheck.
- Anything that requires the running conversation context — sub-agents are amnesiac.
