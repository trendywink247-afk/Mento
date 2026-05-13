# Wave 19 Review — 2026-05-13

## Summary

Two commits audited:
- `c216ed1` fix: Wave 18 critical — pgbouncer healthcheck uses pg_isready (psql not in image)
- `dc7d498` security: declarative role gates + push-token ownership (MINOR-2, MINOR-3)

All three typechecks pass clean. All 142 unit tests pass. No TS6133 unused-import errors. The security fixes are structurally correct. Two issues found: one MINOR (test weakness in PUSH-7) and one documentation gap (no commit SHAs in SECURITY_AUDIT_v0.1.0.md closure table, Wave 19 baseline missing from LOADTEST_BASELINE.md).

## CRITICAL

None.

## MAJOR

None.

## MINOR

### MINOR-A — PUSH-7 test cannot distinguish "token survived" from "idempotent 204 on already-gone token"

File: `/root/Mento/apps/web/e2e/api/push-tokens.spec.ts` lines 120–161

The PUSH-7 test asserts that after user B calls `DELETE /push-tokens/<token-owned-by-A>`, user A can still call `DELETE /push-tokens/<token>` and receive 204. The test then re-registers the token and expects 204. The problem: `deleteMany` always returns 204 regardless of whether 0 or 1 rows were deleted. So the assertion `expect(ownDel.status()).toBe(204)` passes even if user B's delete already wiped the token — user A's delete would hit 0 rows and still return 204. The test does not prove the token survived; it only proves the HTTP contract is idempotent.

The implementation in `push-tokens.service.ts` is correct (`deleteMany({ where: { token, userId } })`). The bug is in the test's verification logic, not the fix. The test should use an admin query, a re-register check that asserts a different lastUsedAt, or a direct DB check to prove the token row still existed before user A's delete.

As written, the PUSH-7 test would pass even if the old (unscoped) `deleteMany({ where: { token } })` were still in place, because both the secure and insecure versions return 204.

### MINOR-B — SECURITY_AUDIT_v0.1.0.md Wave 19 closure table references commit messages, not commit SHAs

File: `/root/Mento/docs/SECURITY_AUDIT_v0.1.0.md` lines 154–159

The "Closed in Wave 19" table has a `Commit` column that contains the commit message string `security: declarative role gates + push-token ownership` rather than the actual SHA (`dc7d498`). Likewise SECURITY.md's Wave 19 closure section (lines 142–170) references no commit SHA at all. This is a traceability gap — the SHA is `dc7d498` for both MINOR-2 and MINOR-3 fixes.

### MINOR-C — LOADTEST_BASELINE.md has no Wave 19 section

File: `/root/Mento/docs/LOADTEST_BASELINE.md`

The audit checklist required a Wave 19 section documenting journal entry P95 = 95ms. The document ends after the Wave 18 section (line 313). No Wave 19 run was documented. The Wave 18 baseline already shows journal_entry isolated P95 = 57ms (well within the 400ms SLO), but the specific 95ms figure cited in the brief is absent from the file. If the Wave 19 re-run (with `type: 'MANUAL_TEXT'` fix applied) was not executed, this is a missing deliverable. If it was executed, the results were not persisted.

### MINOR-D — pgbouncer comment documents 3 failed approaches, not 4

File: `/root/Mento/infra/docker/docker-compose.prod.yml` lines 109–117

The comment says "Three other approaches were tried and failed" and names `SHOW POOLS`, `psql -c 'SELECT 1'`, and `nc -z`. The audit brief specifies documentation of 4 prior approaches. However, on review, `pg_isready` is the current fix rather than a prior failure, so the comment is factually correct with 3 failed approaches. The brief's list of 4 included `pg_isready` as the fix itself. This item closes as acceptable — the comment is accurate, not missing a 4th failed approach.

## What's clean

### PgBouncer healthcheck (`c216ed1`)
- `pg_isready -h localhost -p 6432 -U $$DB_USER -d $$DB_NAME` is correct. Docker runtime confirms `/usr/bin/pg_isready` exists in `edoburu/pgbouncer:latest` (verified by `docker run --rm --entrypoint sh edoburu/pgbouncer:latest -c 'which pg_isready'` → `/usr/bin/pg_isready`).
- `$$DB_USER` and `$$DB_NAME` escaping is correct: double-dollar escapes Docker Compose interpolation so the variables are resolved inside the running container (where they are set as environment variables), not at parse time.
- The three documented failed approaches (`SHOW POOLS`, `psql`, `nc -z`) match the git log history (`7c093fc` tried `nc -z`→SHOW POOLS, `cbf54e1` tried further iterations).
- `start_period: 15s` gives PgBouncer time to connect to Postgres before healthchecks start.

### Declarative @Roles (`dc7d498`)
- `GET /chat-requests`: `@Roles(Role.MENTOR, Role.ASPIRANT)` confirmed present at line 22 of `chat-requests.controller.ts`.
- `GET /sessions/requests`: `@Roles(Role.MENTOR, Role.ASPIRANT)` confirmed present at line 53 of `sessions.controller.ts`.
- `RolesGuard.canActivate()` does `requiredRoles.includes(user.role)` with no ADMIN bypass — ADMIN correctly receives 403 on these endpoints. This is intentional and documented in `SECURITY_AUDIT_v0.1.0.md`.
- `PATCH /chat-requests/:id/archive` intentionally has no `@Roles` decorator (any authenticated user may archive their own requests) — this pre-dates Wave 19 and is unchanged.

### Push-token ownership (`dc7d498`)
- `PushTokensService.unregister(token: string, userId: string)` — signature correctly updated to 2 args.
- Implementation: `deleteMany({ where: { token, userId } })` — scoped to caller's userId.
- `PushTokensController.unregister()` passes `req.user.sub` as userId.
- No other call site uses the old 1-arg `unregister(token)` signature. The only other push-token deletions in the codebase (`moderation.service.ts` lines 221, 340) use `pushToken.deleteMany({ where: { userId } })` directly on the Prisma client (admin-initiated, userId-scoped), which is correct and unaffected.
- 204 response in all cases (no 404 distinguishability) — anonymity/IDOR preserved.

### k6 script fixes (`dc7d498` or adjacent)
- `loadtest/k6/04-journal-upsert-and-entry.js` line 185: `type: 'MANUAL_TEXT'` present in `entryPayload`.
- `loadtest/k6/05-mixed-realistic.js` line 271: `type: 'MANUAL_TEXT'` present in the `doJournalWrite` entry payload.

### SECURITY.md and SECURITY_AUDIT_v0.1.0.md
- "Closed in Wave 19" section exists in both files.
- MINOR-2 marked closed with fix description and file references.
- MINOR-3 marked closed with fix description, file references, and PUSH-7 E2E test reference.

### TypeScript typechecks
- `cd /root/Mento/apps/api && pnpm typecheck` — PASS (no errors, no TS6133)
- `cd /root/Mento/apps/web && pnpm typecheck` — PASS
- `cd /root/Mento/apps/mobile && pnpm typecheck` — PASS

### Unit tests
- `cd /root/Mento/apps/api && pnpm test` — 7 test files, 142 tests, all pass.

*Review performed: 2026-05-13. Reviewer: reviewer agent. Read-only — no files modified.*
