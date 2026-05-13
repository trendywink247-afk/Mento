# Wave 15 Review — 2026-05-13

## Summary

**CONDITIONAL PASS — 0 CRITICAL, 3 MAJOR, 4 MINOR**

All three typechecks pass clean (`apps/api`, `apps/web`, `apps/mobile`). 142/142 unit tests pass. NestJS `nest build` succeeds. `docker compose config` validates without error and the pgbouncer service appears with DATABASE_URL correctly routed through port 6432 with `?pgbouncer=true`. The OTP lockout redaction is correct in the service layer; the lock/fail TTLs match spec; `assertNotLocked` is called before any DB work in `verify()`. However, three issues require a follow-up fix wave before this is fully clean.

---

## CRITICAL

None.

---

## MAJOR

### MAJOR-1 — JOURNAL_CATEGORIES in k6 setup.js are all invalid enum values

`/root/Mento/loadtest/k6/lib/setup.js` lines 224–230 export:

```js
export const JOURNAL_CATEGORIES = [
  'PRELIMS', 'MAINS', 'OPTIONAL', 'INTERVIEW', 'GENERAL',
]
```

The actual `JournalCategory` enum in `/root/Mento/apps/api/prisma/schema.prisma` has 17 values:
`PERSONAL`, `PRELIMS_POLITY`, `PRELIMS_HISTORY`, `PRELIMS_GEOGRAPHY`, `PRELIMS_ECONOMY`,
`PRELIMS_ENVIRONMENT`, `PRELIMS_SCI_TECH`, `PRELIMS_CSAT`, `PRELIMS_CURRENT_AFFAIRS`,
`MAINS_GS1`, `MAINS_GS2`, `MAINS_GS3`, `MAINS_GS4`, `MAINS_ESSAY`, `MAINS_OPTIONAL`,
`INTERVIEW`, `SHARED_WITH_MENTOR`.

None of the five values in `setup.js` (except `INTERVIEW`) match any enum member. Every `doJournalWrite` call in `05-mixed-realistic.js` will receive a `400 Bad Request` (DTO validation rejects the invalid category), making the journal write scenario 100% error — which immediately fails its `overall_error_rate < 0.005` threshold. The load test is broken for the journal scenario.

`GENERAL` also does not exist in the enum. `PRELIMS`, `MAINS`, `OPTIONAL` do not exist.

Fix: replace the five stale strings with the 17 actual enum members (or a representative subset covering the main categories).

### MAJOR-2 — `otp.service.ts` logs raw phone number in dev mode

`/root/Mento/apps/api/src/modules/auth/otp.service.ts` line 76:

```ts
this.logger.warn(`[DEV] OTP for ${phone} = ${code}`)
```

This is executed whenever `MSG91_ENABLED !== 'true'`, which includes all staging and local developer environments. NestJS's `Logger` does not go through Pino's redact pipeline — the CLAUDE.md rules explicitly call out that "services log via Nest Logger which doesn't redact." The raw phone number lands in structured logs, creating a PII leak in every non-production environment and in any staging deployment that hasn't enabled MSG91.

The Wave 15 audit brief required that the lockout log line be redacted (and it correctly is: line 146 uses `[REDACTED]`). The same discipline must be applied to the dev OTP log.

Fix: `this.logger.warn('[DEV] OTP issued for [REDACTED]; check devCode in response')` and remove the code value from the log entirely (it is already returned in the response body; logging it adds no debugging value and risks OTP leakage to log aggregators).

### MAJOR-3 — `requestOtp` response echoes raw phone number back to the client

`/root/Mento/apps/api/src/modules/auth/auth.controller.ts` line 36:

```ts
return { phone: body.phone, ...result }
```

The `requestOtp` endpoint returns `{ phone: "+91...", expiresIn: 300, devCode?: "..." }`. The phone number is already known to the caller (they just POSTed it), so echoing it is harmless functionally. However, it violates the principle that API responses never surface PII fields — any log interceptor, API gateway, or response-capture tool that records the JSON body will now index the raw phone number. The `verifyOtp` response also returns `user.phone` and `user.email` (lines 56–57) which is a more severe pre-existing issue (Phase 1 origin, also in scope of this audit since ANONYMITY is a project-level invariant).

The CLAUDE.md anonymity rule — "never expose phone/email in public responses. Always return displayHandle + avatarLetter + avatarColor + hasPurpleTick" — is violated by both endpoints.

Fix:
- `requestOtp`: remove `phone: body.phone` from the return object (caller already knows their own phone).
- `verifyOtp`: remove `phone: user.phone` and `email: user.email` from the user object in the response. The mobile/web clients only need `id`, `role`, `status`, `createdAt`, `updatedAt`.

Note: this is a pre-existing issue (introduced in Phase 1, commit `822d7d1`) that Wave 15 touched the controller without fixing. It should be tracked as a blocker before first paid launch.

---

## MINOR

### MINOR-1 — loadtest result files remain git-tracked despite new .gitignore

`git ls-files loadtest/results/` returns five tracked files including `02-mentor-discovery.txt` (2.4 GB on disk). The `.gitignore` rule added in Wave 15 (`loadtest/results/*`) prevents future untracked files from being accidentally staged, but does not untrack already-indexed files. The commit message acknowledges this and documents the `git filter-repo` command, which is correct. However, the files are still in the index and will be cloned by anyone pulling the repo.

Action required before pushing to any remote: `git rm --cached loadtest/results/*.txt` + new commit, followed by `git filter-repo --invert-paths --path loadtest/results/02-mentor-discovery.txt` to excise the 2.4 GB blob from history. The .gitignore comment correctly documents this; it just hasn't been executed.

### MINOR-2 — PgBouncer healthcheck uses `nc`; presence in image is assumed, not verified

`/root/Mento/infra/docker/docker-compose.prod.yml` line 107:

```yaml
test: ["CMD", "sh", "-c", "nc -z localhost 6432 || exit 1"]
```

`edoburu/pgbouncer:1.23.1` is Alpine-based; `nc` is available via BusyBox in most Alpine images. However, `psql -h localhost -p 6432 -c '\q'` or `pg_isready -h localhost -p 6432` would be a more semantically correct health probe (confirming PgBouncer is accepting connections, not just that the port is bound). Low risk in practice but worth noting for the runbook.

### MINOR-3 — Race window between `assertNotLocked` and `recordFailure` under high concurrency

Under load (e.g., the 500-VU scenario in `05-mixed-realistic.js`), two concurrent verify requests for the same phone with failure count at 4 can both pass `assertNotLocked` before either of them triggers the lockout. Both will proceed to DB lookup, both will fail bcrypt compare, both will call `recordFailure`. Redis `INCR` is atomic so one gets 5 (triggers lock + del) and the other gets 6 (re-triggers, idempotent SET). The outcome is correct — the phone gets locked.

The real exposure is the window between assertNotLocked returning and the lock key being written: during that window an attacker with enough concurrency (e.g., 499 in-flight verify calls) could exhaust the DB attempt counter on the OTP record before the lock fires. This is mitigated by the Prisma-level `attempts >= MAX_ATTEMPTS` guard on the OTP record itself, which provides defense-in-depth. No immediate fix required, but a Lua script atomically combining INCR + conditional SET would eliminate the window entirely if the OTP service is ever identified as a DDoS target.

### MINOR-4 — k6 `setup.js` `createUser()` logs raw phone in error paths

`/root/Mento/loadtest/k6/lib/setup.js` lines 79, 87, 110, 118 contain:

```js
console.error(`[setup] OTP request failed for ${phone}: ...`)
```

These are k6 load-test scripts, not production NestJS code, so PII in k6 console output goes to the operator terminal / CI log artifact, not to any production log aggregator. Acceptable in load-test context since the "phones" are synthetic `+9174XXXXXXXX` numbers. Not a production anonymity concern, but worth noting for completeness.

---

## What's clean

- **TypeScript**: all three apps (`api`, `web`, `mobile`) typecheck with zero errors. No TS6133 unused-import violations.
- **NestJS build**: `nest build` completes without errors.
- **142 unit tests**: all pass, including the 15 new OTP spec tests.
- **OTP lockout implementation**: `assertNotLocked` is called before DB work in `verify()`. `recordFailure` uses Redis `INCR` (atomic). Lock TTL = 30 min (`LOCKOUT_SECONDS = 30 * 60`), fail window TTL = 10 min (`FAIL_WINDOW_SECONDS = 10 * 60`) — both match spec. `clearFailures` deletes both keys on success.
- **Lockout log redaction**: line 146 correctly logs `phone [REDACTED]` — the raw phone does not appear in the lockout log line.
- **ioredis `lazyConnect: true`**: confirmed in constructor; no eager connection at startup.
- **`@SkipThrottle()` on both OTP endpoints**: confirmed on both `otp/request` and `otp/verify`.
- **k6 scripts — URLSearchParams removed**: `02-mentor-discovery.js` and `05-mixed-realistic.js` both use `qs()` from `lib/setup.js`. No `new URLSearchParams()` anywhere in k6 scripts.
- **`qs()` helper added to `lib/setup.js`**: present at lines 244–251 with correct implementation.
- **`01-onboarding.js` mirror payload**: `journeyStage` picks from valid enum values (`ABOUT_TO_START`, `ONE_YEAR_IN`, `PRELIMS_CLEARED`, `MAINS_WRITTEN`). `challenges` is a `string[]`. `knowledge` is `Record<string, number>`. All correct.
- **PgBouncer in prod compose**: `edoburu/pgbouncer:1.23.1` service present. `POOL_MODE=transaction`. `DEFAULT_POOL_SIZE=25`. `AUTH_TYPE=scram-sha-256`. `depends_on: postgres: service_healthy`. Healthcheck present.
- **`DATABASE_URL` through PgBouncer**: `postgresql://mento:...@pgbouncer:6432/mento?pgbouncer=true` — correct.
- **`MIGRATIONS_DATABASE_URL` direct**: `postgresql://mento:...@postgres:5432/mento` — no `?pgbouncer=true`, correct.
- **`api.depends_on`**: waits on `pgbouncer: service_healthy` and `redis: service_healthy`.
- **`docs/DEPLOY.md`**: migrate-deploy command uses `$MIGRATIONS_DATABASE_URL` (see §2e). Correct.
- **`.env.prod.example`**: documents both `DATABASE_URL` (pgbouncer, port 6432) and `MIGRATIONS_DATABASE_URL` (direct postgres, port 5432) with inline explanations.
- **`SCALING_PLAYBOOK.md`** (`/root/Mento/loadtest/SCALING_PLAYBOOK.md`): PgBouncer section (§3) correctly marked as "SHIPPED in prod compose" with checklist item `[x]`.
- **`docs/FOUNDER.md`**: verdict is GREEN (no YELLOW remaining). Test count row says 142. Journal categories row says 17 and lists all 17. The 7-credential operator checklist replaces the former 7-blocker list.
- **`.gitignore`**: `loadtest/results/*` rule present with `!loadtest/results/.gitkeep` exception and `git filter-repo` comment.
- **No `console.log` in production NestJS source**: `apps/api/src/` (excluding spec files) has zero raw `console.log` statements. `apps/web/` and `apps/mobile/` likewise clean.
- **`docker compose config`** parses without error. pgbouncer service appears. api DATABASE_URL resolves to `pgbouncer:6432`. MIGRATIONS_DATABASE_URL resolves to `postgres:5432`.
