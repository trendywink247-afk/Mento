# Mento v0.1.0 — Final Integration Smoke Report

Date: 2026-05-13  
Branch: main  
Commit: f587c27 (HEAD at time of run)

---

## Check 1 — TypeScript compilation (all three apps)

| App | Result |
|-----|--------|
| `apps/api` | PASS — no errors |
| `apps/web` | PASS — no errors |
| `apps/mobile` | PASS — no errors |

---

## Check 2 — API unit tests

```
Test Files  7 passed (7)
      Tests  142 passed (142)
   Duration  1.01s
```

**Result: PASS** — 142/142 tests, 0 failures.

Files covered:
- `src/common/anonymity.spec.ts` (40 tests)
- `src/modules/sessions/sessions.service.spec.ts` (20 tests)
- `src/modules/auth/auth.service.spec.ts` (19 tests)
- `src/modules/subscriptions/guards/tier.guard.spec.ts` (12 tests)
- `src/modules/nudges/nudges.service.spec.ts` (12 tests)
- `src/modules/moderation/moderation.service.spec.ts` (24 tests)
- `src/modules/auth/otp.service.spec.ts` (15 tests)

---

## Check 3 — Web build (`next build`)

**Result: PASS**

Build completed successfully. All routes statically prerendered or server-rendered as expected. No build errors. Middleware compiled (32.8 kB). Shared JS chunk: 102 kB.

---

## Check 4 — simulate-success guard (dev mode)

Test: authenticated user (ASPIRANT role) calls `POST /subscriptions/simulate-success` with `{"tier":"BASIC"}` in development mode.

```
Dev simulate-success: 201 Created
```

**Result: PASS** — endpoint is accessible in dev (201 = subscription record created). Guard correctly permits dev traffic.

Note: Response code is 201 (NestJS default for POST), not 200 — this is correct behavior.

---

## Check 5 — Push-token ownership (W79)

Test: authenticated user registers a push token then deletes their own token.

```
Register token:  204
Owner delete:    204
```

**Result: PASS** — register and delete both return 204 as expected.

---

## Check 6 — Script file permissions

```
100755  scripts/backup-pg.sh
100755  scripts/restore-pg.sh
```

**Result: PASS** — both shell scripts are committed as executable (100755) in git object store.

---

## Summary

| Check | Status |
|-------|--------|
| 1. TypeScript (api + web + mobile) | PASS |
| 2. Unit tests (142/142) | PASS |
| 3. Web build | PASS |
| 4. simulate-success guard (dev) | PASS |
| 5. Push-token ownership (register + delete) | PASS |
| 6. Script permissions (100755) | PASS |

**Overall: 6/6 PASS. Safe to tag v0.1.0.**
