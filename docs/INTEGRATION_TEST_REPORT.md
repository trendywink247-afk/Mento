# Integration Test Report — 2026-05-13

## Headline

Wave 8 regression suite: 115 Vitest unit tests pass; API E2E 38/40 pass (2 fail — DB enum mismatch blocking suspend); browser E2E 38/66 pass (21 fail — keyboard nav, payments data-testid, moderation UI, onboarding flow; 7 did not run).

## Results

| Layer | Pass | Fail | Skip/DNR | Notes |
|---|---|---|---|---|
| Vitest unit (api) | 115 | 0 | 0 | 5 files: anonymity, sessions, tier-guard, auth, moderation service |
| Typecheck (api) | ✅ | 0 | — | `tsc --noEmit` clean |
| Typecheck (web) | ✅ | 0 | — | `tsc --noEmit` clean |
| Typecheck (mobile) | ✅ | 0 | — | `tsc --noEmit` clean |
| Web build | ✅ | 0 | — | 37 routes; `/privacy`, `/terms`, `/refund-policy` confirmed present |
| Playwright API | 38 | 2 | 0 | After admin seed: MOD-3, MOD-4 still fail (see §Failures) |
| Playwright desktop-chromium | 38 | 21 | 7 | Keyboard, payments testid, moderation UI, onboarding (see §Failures) |

## Failures (if any)

### Playwright API — 2 failing

**Root cause: DB enum `ModerationAction` is out of sync with Prisma schema.**

The Prisma schema defines six enum values (`WARN`, `DISMISS`, `SUSPEND_ASPIRANT`, `SUSPEND_MENTOR`, `BAN_ASPIRANT`, `BAN_MENTOR`) but the live Postgres enum only contains four (`WARN`, `BAN_ASPIRANT`, `BAN_MENTOR`, `BAN_BOTH`). The values `DISMISS`, `SUSPEND_ASPIRANT`, `SUSPEND_MENTOR` do not exist in the DB, so any INSERT into `ModerationActionLog` with those values throws `invalid input value for enum "ModerationAction"` → the transaction rolls back → the controller returns 500.

Fix required (not executed — out of scope for read-only test run):
```bash
cd /root/Mento/apps/api && pnpm prisma db push --accept-data-loss
# or proper migration:
pnpm prisma migrate dev --name add-moderation-action-enum-values
```

- **MOD-3** (`moderation.spec.ts:62`) — `PATCH /admin/users/:id/status` with `{ status: "SUSPENDED" }` returns 500 instead of 200. Postgres error: `invalid input value for enum "ModerationAction": "SUSPEND_ASPIRANT"` in the ModerationActionLog INSERT.

- **MOD-4** (`moderation.spec.ts:88`) — Same root cause. The suspend step returns 500, so the test fails at the `expect(suspendRes.status()).toBe(200)` assertion at line 100.

### Playwright desktop-chromium — 21 failing (grouped by root cause)

**Group 1 — keyboard.spec.ts (12 tests)**
All 12 keyboard navigation tests fail because they rely on being in an authenticated session (dashboard, chat, mirror, mentors, journals) or on specific ARIA attributes that may have shifted in Wave 8 UI updates. Representative errors:
- Login page Send-OTP button is `disabled` when the test tries to click it (the form validation requires the terms checkbox to be checked first, or phone input to be filled — the keyboard test does not fill the phone before asserting focusability).
- Dashboard sidebar: `aside nav a` count is 0 — likely the sidebar uses a different element structure now.
- Chat tabs: `[role="tab"]` count is 0 — chat tabs may use a different component now.
- Mentors: `#mentor-search`, `#mentor-sort`, Filters button not found — element IDs may have changed.

**Group 2 — moderation-flow.spec.ts (4 UI tests: MOD-UI-1 through MOD-UI-4)**
The admin moderation queue page (`/admin/moderation`) does not render the "Moderation Queue" heading within the 15 s timeout. Likely cause: the admin login flow in the browser test goes through OTP, but the admin session from auth-setup may not route to `/admin/moderation` correctly. MOD-UI-5 (non-admin redirect) and all unauthenticated assertions pass, confirming routing exists but auth-context for admin is not established.

**Group 3 — payments-flow.spec.ts (2 UI tests: PAY-UI-1, PAY-UI-2)**
`[data-testid="tier-card-basic"]`, `[data-testid="tier-card-pro"]`, `[data-testid="tier-card-max"]` not found on `/upgrade` within 15 s. The upgrade page loads (PAY-UI-3 passes for unauthenticated), but the authenticated view does not render tier cards with those data-testids. Either the testids were not added to the component, or the authenticated state is not being picked up.

**Group 4 — ui-tour.spec.ts:58 and ui-tour-extras.spec.ts:57 (2 tests)**
- `ui-tour.spec.ts:58` — Clicking "preparing for UPSC" button on role-pick page does not navigate to `/onboarding/welcome` within 60 s timeout. This is the public role-pick flow — the button behaviour may have changed.
- `ui-tour-extras.spec.ts:57` — Dashboard + journals + chat + mentors empty states: navigation or element lookup fails.

**Group 5 — web-onboarding.spec.ts:6 (1 test)**
The terms checkbox is checked but "Send OTP" remains disabled when the test tries to click it. The phone input field was likely not filled first (the test fills phone then checks terms checkbox — if the phone validation fires asynchronously, the button may still be disabled at click time).

**7 tests did not run** — These are sequential dependencies of earlier failures (mentor onboarding wizard, mobile UA redirect, etc.).

## Operational preconditions met

- [x] api on :4000 (`GET /healthz` returns `{"status":"ok","uptime":...}`)
- [x] web on :3030 (was already up at start of run)
- [x] postgres on :5433 (TCP connect succeeds; API is actively using it)
- [x] redis on :6380 (TCP connect succeeds)
- [x] admin user seeded (`+910000000000` promoted to ADMIN via `ADMIN_BOOTSTRAP_PHONE=+910000000000 DATABASE_URL=... pnpm db:seed`)

## Action items for next wave

1. **BLOCKING — DB schema sync:** Run `pnpm prisma db push` (or a migration) to add `DISMISS`, `SUSPEND_ASPIRANT`, `SUSPEND_MENTOR` to the `ModerationAction` enum in Postgres. This unblocks MOD-3, MOD-4 (API) and likely MOD-UI-1 through MOD-UI-4 (browser) if they depend on the suspend endpoint.

2. **HIGH — Payments tier cards:** Add `data-testid="tier-card-basic"`, `data-testid="tier-card-pro"`, `data-testid="tier-card-max"` to the tier card components in `/upgrade` page.

3. **MEDIUM — Keyboard spec ARIA selectors:** Audit `keyboard.spec.ts` selectors against current DOM — `#mentor-search`, `#mentor-sort`, `aside nav a`, `[role="tab"]` — and update to match current component output.

4. **LOW — Onboarding / UI-tour race conditions:** The `web-onboarding.spec.ts` click-then-click pattern may need an explicit phone-fill wait or the terms-checkbox-enabled check before clicking Send OTP.
