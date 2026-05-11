# Mento — Sub-Agent Delegation Guide

> Read after `CLAUDE.md`. Use when delegating work via the `Agent` tool.

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
| LLM / AI features (Phase 2+) | `llm-agent` |
| Designing UI / design tokens / Figma | `designer` |

## Dispatch policy

- **Parallel up to 6 agents** when tasks are truly independent.
- **All sub-agents use `model: sonnet`** by default. Do not override.
- **Worktree isolation** (`isolation: "worktree"`) for code-writing agents. Read-only agents (`planner`, `reviewer`, `Explore`) don't need worktrees.
- **Briefing is mandatory.** Sub-agents have ZERO context from the parent conversation. Every prompt must include: what to do, which files to touch, acceptance criteria, what NOT to do, the relevant section of `docs/Requirement.md`.

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
```

## Review loop convention (after a coding agent finishes)

1. Spawn `reviewer` with the diff and a checklist (anonymity, typecheck, copy, spec alignment, regressions).
2. If reviewer reports issues → spawn the appropriate coding agent with the fix list (briefing template above).
3. Re-spawn `reviewer` to verify.
4. Repeat until clean OR 7 iterations max.

`/double-check` shorthand = one review pass.

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
