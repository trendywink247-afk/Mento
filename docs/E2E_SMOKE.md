# E2E Smoke Test Report

**Date:** 2026-05-13
**Commit SHA:** d4590b992572b2de39a8e480f91b3d3bb9b9ecbd
**Commit message:** test: Vitest unit tests for service-layer business logic

---

## Summary

| Project           | Passed | Failed | Skipped | Total |
|-------------------|--------|--------|---------|-------|
| api               | 34     | 6      | 0       | 40    |
| desktop-chromium  | 44     | 15     | 7       | 66    |
| mobile-android    | not run| –      | –       | –     |
| a11y (sub-run)    | 13     | 4      | 0       | 17    |

Note: a11y failures are already counted inside the desktop-chromium totals above.

## Web Server Status

Web was DOWN at start of run. Started with `pnpm dev` on port 3030.
Web came up within 2 seconds. All desktop-chromium and a11y specs ran against it.

## Playwright HTML Report

Generated at: `/root/Mento/apps/web/playwright-report/index.html`

---

## API Project Failures (6)

### MOD-1 through MOD-5: All moderation tests (5 failures)

**Root cause:** Pre-condition not met — the bootstrap admin user (`+910000000000`) exists in the database with `role=ASPIRANT` instead of `role=ADMIN`. The seed script (`prisma/seed.ts`) was never run with `ADMIN_BOOTSTRAP_PHONE` set, so the user was created with the default `ASPIRANT` role via OTP flow. Since seed skips if the user already exists, `pnpm db:seed` would also skip.

All moderation tests call `createAdminSession(request)` which OTPs into `+910000000000` and then hits `@Roles(Role.ADMIN)`-guarded routes — resulting in `403 Requires role: ADMIN`.

**Affected tests:**
- `MOD-1: admin can list moderation reports` → `GET /admin/moderation/reports` returns 403
- `MOD-2: report list does not leak phone/email/googleSub` → depends on MOD-1 (res.ok() returns false)
- `MOD-3: admin suspends a user` → `PATCH /admin/users/:id/status` returns 403
- `MOD-4: suspended user cannot sign in again via OTP` → `PATCH /admin/users/:id/status` returns 403 (test line 100)
- `MOD-5: admin bans a user` → `PATCH /admin/users/:id/status` returns 403

**Fix required (not a test bug — infrastructure issue):**
```sql
-- One-time fix:
UPDATE "User" SET role = 'ADMIN' WHERE phone = '+910000000000';
```
Or delete the user and run `ADMIN_BOOTSTRAP_PHONE=+910000000000 pnpm db:seed` from `apps/api`.

---

### PUSH-5: DELETE is idempotent for non-existent token → expects 204, gets 401

**Error:**
```
Expected: 204
Received: 401
at push-tokens.spec.ts:103
```

**Root cause:** The test calls `DELETE /push-tokens/:token` with NO auth header (line 102), expecting 204 because it's an idempotent delete of a non-existent token. However, `PushTokensController.unregister()` does not have `@Public()` — the global `JwtAuthGuard` requires a valid JWT and returns 401.

There are two possible interpretations:
1. **Spec is wrong** — unauthenticated DELETE should be 401 (this is the current implementation).
2. **Implementation is wrong** — the service uses `deleteMany` which silently no-ops on missing rows, so allowing unauthenticated DELETE of any token string would be safe. The spec comment says "The service uses deleteMany which does not throw on missing rows."

The spec intent (based on the comment) is that DELETE should be callable without auth for idempotency. This would need `@Public()` added to the `unregister` endpoint, which is an application code change. This is documented here as a spec/implementation mismatch for the backend team to resolve.

---

## Desktop-Chromium Failures (15)

### A11y failures (4 tests) — WCAG 2.1A: nested-interactive violation

**Tests:**
- `a11y — authenticated pages › dashboard /dashboard`
- `a11y — authenticated pages › journals /journals`
- `a11y — authenticated pages › chat /chat`
- `a11y — authenticated pages › mentors /mentors`

**Error excerpt:**
```
Axe violations found:
"help": "Interactive controls must not be nested"
"helpUrl": "https://dequeuniversity.com/rules/axe/4.11/nested-interactive"
"target": [".text-left"]
"tags": ["wcag2a", "wcag412"]
```

**Root cause:** An interactive element (likely a `<button>`) is nested inside another interactive element inside the authenticated dashboard layout. The CSS class `.text-left` is the target. This is a production WCAG 2.1A compliance bug affecting all authenticated dashboard pages. Axe rule: `nested-interactive`.

---

### Keyboard — chat (2 tests)

**Test:** `keyboard — chat › chat tab buttons all have role=tab and aria-selected`
```
Expected: 4
Received: 3
at keyboard.spec.ts:312
```

**Root cause:** The spec expects 4 chat tabs (`[role="tab"]`) but the chat page renders only 3. Either a tab was added to the spec that was never implemented in the UI, or a tab was removed from the UI after the spec was written.

**Test:** `keyboard — chat › chat tabs are keyboard-focusable`
```
Error: element(s) not found
locator: getByRole('tab', { name: /pending/i })
```

**Root cause:** Cascading from the tab-count mismatch — the `Pending` tab by that exact name may not exist (possibly renamed or not present).

---

### Moderation browser tests (4 tests) — Same root cause as API failures

**Tests:** MOD-UI-1, MOD-UI-2, MOD-UI-3, MOD-UI-4

**Error:** Admin user (`+910000000000`) authenticates with `ASPIRANT` role. The frontend app redirects non-admins away from `/admin/moderation`, so the heading "Moderation Queue" is never found.

Same root cause as API MOD-1 through MOD-5: admin user in DB has wrong role.

---

### Payments browser tests (2 tests)

**Test:** `PAY-UI-1: /upgrade page shows 3 paid tier cards when signed in`
```
Error: strict mode violation: getByRole('button', { name: /basic/i }) resolved to 2 elements
```

**Root cause:** The `/upgrade` page renders the `basic` plan button in two places (e.g., in both a card and a CTA row, or in a comparison table). The spec uses an unqualified `getByRole('button', { name: /basic/i })` locator which resolves to multiple elements.

**Test:** `PAY-UI-2: activate pro in dev mode shows success message`
```
Error: strict mode violation: getByRole('button', { name: /pro/i }) resolved to 3 elements
```

**Root cause:** Same pattern — `pro` appears in multiple buttons on the upgrade page (e.g., plan card, header, comparison row). Specs need more specific locators using `data-testid` attributes.

---

### UI Tour — public surfaces (1 test)

**Test:** `UI tour @desktop › public surfaces`
```
Error: strict mode violation: getByRole('link', { name: /get started/i }) resolved to 2 elements:
  1) "Get started"
  2) "Get started — it's free"
```

**Root cause:** The landing page (`/`) now renders two CTAs: one with exact text "Get started" and one with "Get started — it's free". The spec's `/get started/i` regex matches both. The landing page was updated with an additional CTA button after the spec was written.

---

### Web Onboarding happy path (1 test)

**Test:** `Web — happy path onboarding › landing → role pick → ...`
```
Error: strict mode violation: getByRole('heading', { name: 'Mento' }) resolved to 3 elements:
  - "Real mentors who've cleared the journey."
  - "What Mento is NOT"
  - "Find the mentor you needed."
```

**Root cause:** The spec looks for `getByRole('heading', { name: 'Mento' })` expecting a specific `<h1>Mento</h1>` on the landing page. The landing page appears to not have a lone `<h1>Mento</h1>` — only `<h2>` elements that axe recognizes as having "Mento" in their accessible name via ARIA or partial match. The landing page structure changed: the top-level brand "Mento" heading may now be in a `<nav>` or `<header>` that axe doesn't expose as `heading` role, and Playwright's `getByRole('heading', { name: 'Mento' })` substring-matches against 3 other headings.

---

### UI Tour Extras (1 test)

**Test:** `UI tour extras @desktop › dashboard + journals + chat + mentors empty states`
```
TimeoutError: locator.fill: Timeout 10000ms exceeded.
await page.getByPlaceholder(/91987/i).fill(phone)
at ui-tour-extras.spec.ts:25
```

**Root cause:** The login page placeholder text no longer matches `/91987/i`. Either the placeholder was changed in the login form or it requires a different format. The phone input on the login page no longer has a placeholder containing "91987".

---

## Recommendations

### Critical (blocking CI)

1. **Fix admin user role** — Run the DB seed or execute the one-time SQL above to promote `+910000000000` to `ADMIN`. All 5 MOD API tests and 4 MOD browser tests will pass once this is done.

2. **WCAG nested-interactive violation** — Find the `.text-left`-classed element inside the authenticated layout that wraps a button inside a button/link. Fix the nesting. Affects 4 a11y tests across all authenticated pages.

3. **Chat tab count mismatch** — Chat page renders 3 `[role="tab"]` elements; spec expects 4. Sync the expected count in `keyboard.spec.ts:312` with the actual tab count, or restore the missing tab. Given the spec was written alongside the implementation, the UI likely dropped a tab.

### Medium (spec locators stale after UI changes)

4. **Landing page duplicate CTAs** — `ui-tour.spec.ts:53` and `web-onboarding.spec.ts:13` use loose locators. Use `.first()` or switch to `data-testid` on the primary CTA. The landing page now has two "Get started" CTAs.

5. **Payments upgrade page strict-mode violations** — Add `data-testid="tier-card-basic"` / `data-testid="tier-card-pro"` to the upgrade page tier cards and update `payments-flow.spec.ts` to use them.

6. **Login phone placeholder** — `ui-tour-extras.spec.ts` and `ui-tour.spec.ts` use `getByPlaceholder(/91987/i)`. Verify the current placeholder text on `/login` and update the regex in both spec files.

7. **Landing page heading structure** — `web-onboarding.spec.ts:12` expects `getByRole('heading', { name: 'Mento' })`. Add `data-testid="landing-brand-heading"` to the brand heading on the landing page and update the spec.

### Low

8. **PUSH-5 spec/implementation gap** — Decide whether `DELETE /push-tokens/:token` should be public. If yes, add `@Public()` to the controller method. If no, update the spec to send an auth header.

9. **Re-run full suite after admin fix** — The MOD failures may cascade into some desktop-chromium tests passing. Re-run after fixing the admin user role.
