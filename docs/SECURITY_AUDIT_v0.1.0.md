# Security Audit — v0.1.0

## Headline

All `/admin/*` routes are correctly protected with `@Roles(Role.ADMIN)`. No critical RBAC bypass found. Three minor issues and one documentation gap identified.

---

## Guard Architecture

Guards are registered in `apps/api/src/modules/auth/auth.module.ts` as global `APP_GUARD` providers (not in `app.module.ts`). Registration order is correct: `JwtAuthGuard` first, then `RolesGuard` — JWT populates `req.user` before the roles check runs.

```
{ provide: APP_GUARD, useClass: JwtAuthGuard },   // line 52
{ provide: APP_GUARD, useClass: RolesGuard },     // line 53
```

`JwtAuthGuard` respects `@Public()` (short-circuits before Passport). `RolesGuard` allows all routes that have no `@Roles()` decorator (passes if `requiredRoles` is empty/absent) — JWT auth still applies to those routes.

---

## /admin/* Routes

| Route | Controller file | Class-level guard | Method-level guard | @Public? | Anonymized? | E2E test |
|---|---|---|---|---|---|---|
| GET /admin/users | admin.controller.ts | `@Roles(ADMIN)` | — | No | No — returns phone+email (admin spec) | api-security.spec.ts SEC-4 |
| PATCH /admin/users/:id/role | admin.controller.ts | `@Roles(ADMIN)` | — | No | N/A (mutation) | — |
| GET /admin/mentors/pending | admin.controller.ts | `@Roles(ADMIN)` | — | No | Yes — phone/email not included | — |
| POST /admin/mentors/:id/approve | admin.controller.ts | `@Roles(ADMIN)` | — | No | N/A | — |
| POST /admin/mentors/:id/reject | admin.controller.ts | `@Roles(ADMIN)` | — | No | N/A | — |
| POST /admin/mentors/:id/ban | admin.controller.ts | `@Roles(ADMIN)` | — | No | N/A | — |
| GET /admin/audit-logs | admin.controller.ts | `@Roles(ADMIN)` | — | No | No user PII in payload | — |
| GET /admin/moderation/reports | moderation.controller.ts | `@Roles(ADMIN)` | — | No | Yes — anonymizeUser() helper | api/moderation.spec.ts MOD-1,2,6,7 |
| GET /admin/moderation/reports/:id | moderation.controller.ts | `@Roles(ADMIN)` | — | No | Yes — anonymizeUser() helper | — |
| PATCH /admin/moderation/reports/:id/resolve | moderation.controller.ts | `@Roles(ADMIN)` | — | No | N/A | api/moderation.spec.ts MOD-3,4,5 |
| GET /admin/users/:id | moderation.controller.ts | `@Roles(ADMIN)` | — | No | No — returns phone+email (admin spec) | api/moderation.spec.ts MOD-5 |
| PATCH /admin/users/:id/status | moderation.controller.ts | `@Roles(ADMIN)` | — | No | N/A | api/moderation.spec.ts MOD-3,8 |
| GET /admin/analytics/summary | analytics.controller.ts | `@Roles(ADMIN)` | — | No | Yes — aggregate counts only | — |
| GET /admin/flags | flags.controller.ts | `@Roles(ADMIN)` | — | No | No user data | — |
| PATCH /admin/flags/:key | flags.controller.ts | `@Roles(ADMIN)` | — | No | No user data | — |
| POST /admin/flags/seed | flags.controller.ts | `@Roles(ADMIN)` | — | No | No user data | — |
| POST /admin/invites | invites.controller.ts | — | `@Roles(ADMIN)` per method | No | No user PII | — |
| GET /admin/invites | invites.controller.ts | — | `@Roles(ADMIN)` per method | No | No user PII | — |
| PATCH /admin/invites/:id/disable | invites.controller.ts | — | `@Roles(ADMIN)` per method | No | No user PII | — |
| POST /admin/nudges/trigger | nudges-admin.controller.ts | `@Roles(ADMIN)` | — | No | No user PII | — |
| GET /assignments | assignments.controller.ts | — | `@Roles(ADMIN)` per method | No | No user PII | — |
| POST /assignments | assignments.controller.ts | — | `@Roles(ADMIN)` per method | No | No user PII | — |
| DELETE /assignments/:id | assignments.controller.ts | — | `@Roles(ADMIN)` per method | No | No user PII | — |

**Verdict: ZERO admin routes are unguarded or @Public.**

---

## Role-Gated Non-Admin Routes

| Route | Required role | Method | Controller file | E2E test |
|---|---|---|---|---|
| GET /mentors/mentees | MENTOR | GET | mentors.controller.ts | — |
| PATCH /me/mentor/availability | MENTOR | PATCH | sessions.controller.ts | — |
| PATCH /sessions/requests/:id/accept | MENTOR | PATCH | sessions.controller.ts | api/sessions.spec.ts SES-7 |
| PATCH /sessions/requests/:id/decline | MENTOR | PATCH | sessions.controller.ts | — |
| POST /chat-requests | ASPIRANT | POST | chat-requests.controller.ts | — |
| PATCH /chat-requests/:id/accept | MENTOR | PATCH | chat-requests.controller.ts | — |
| PATCH /chat-requests/:id/decline | MENTOR | PATCH | chat-requests.controller.ts | — |
| POST /sessions/requests | ASPIRANT | POST | sessions.controller.ts | api/sessions.spec.ts SES-7,8 |
| PATCH /sessions/requests/:id/cancel | ASPIRANT | PATCH | sessions.controller.ts | — |

**Routes with NO role restriction (JWT-auth only — any authenticated user):**

| Route | Note |
|---|---|
| GET /chat-requests | `@Roles(MENTOR, ASPIRANT)` added in Wave 19 — MINOR-2 closed |
| PATCH /chat-requests/:id/archive | Any authenticated user can archive — intentional |
| GET /sessions/requests | `@Roles(MENTOR, ASPIRANT)` added in Wave 19 — MINOR-2 closed |
| GET /sessions/availability/:mentorId | Public-facing availability read — intentional |
| GET /wallet | Any authenticated user sees own wallet — intentional |
| GET /conversations, GET /conversations/:id/messages | Any authenticated user — intentional |
| PATCH /conversations/:id/archive | Any authenticated user — intentional |
| POST /chat/messages/:messageId/report | Any authenticated user — intentional |
| POST /push-tokens | Any authenticated user — intentional |
| DELETE /push-tokens/:token | Ownership-scoped in Wave 19 — MINOR-3 closed |
| GET /journals/* (all) | Any authenticated user owns their journals — intentional |
| GET /onboarding/state, POST /onboarding/mirror, POST /onboarding/mentor* | Any authenticated user — intentional |
| GET /me, POST /storage/presign, GET /subscriptions/me, POST /subscriptions/checkout, POST /subscriptions/cancel | Any authenticated user — intentional |

---

## Public-But-Admin-Shaped Routes

| Route | Decorator | Justification |
|---|---|---|
| POST /auth/otp/request | `@Public()` | Pre-auth — no identity yet |
| POST /auth/otp/verify | `@Public()` | Pre-auth — no identity yet |
| POST /auth/google | `@Public()` | Pre-auth |
| POST /auth/refresh | `@Public()` | Token refresh requires no JWT |
| POST /auth/logout | `@Public()` | Must work even with expired JWT |
| GET /healthz, GET /readyz | `@Public()` | Load balancer probes |
| GET /metrics | `@Public()` | Prometheus scraper; Caddy blocks public internet access |
| GET /flags | `@Public()` | Feature flags cached in Redis — no sensitive data |
| POST /invites/redeem | `@Public()` | Invite code validation before OTP; read-only, no side effects |
| POST /onboarding/role, POST /onboarding/event | `@Public()` | Pre-auth funnel analytics |
| POST /dev-upload/:key, GET /dev-read/:key | `@Public()` | Dev-only local file store; service returns 403 if `NODE_ENV=production` |
| POST /subscriptions/webhook | `@Public()` | Razorpay calls in; HMAC signature verified inside service |

All are correctly marked `@Public()` for legitimate reasons.

---

## Findings

### MINOR

- **(MINOR-1) `POST /subscriptions/simulate-success` is JWT-gated but not locked to dev/staging at the transport layer.** Any authenticated user (any role) can call it. The service throws `ForbiddenException` if `NODE_ENV=production` and `RAZORPAY_KEY_ID` is set — but this is a runtime check, not a guard. If `NODE_ENV` is accidentally unset on a production deployment, the endpoint becomes active. Recommend adding a dedicated `@DevOnly()` guard or removing the route via `app.module.ts` conditional module import when in production.
  - File: `/root/Mento/apps/api/src/modules/subscriptions/subscriptions.controller.ts` line 49–51
  - File: `/root/Mento/apps/api/src/modules/subscriptions/subscriptions.service.ts` line 229

- **(MINOR-2) ~~`GET /chat-requests` and `GET /sessions/requests` have no `@Roles()` decorator.`~~ CLOSED in Wave 19 (2026-05-13).** `@Roles(Role.MENTOR, Role.ASPIRANT)` added to both list endpoints. Admins now receive 403 on these role-branching endpoints, which is correct — they use `/admin/*` for data visibility.
  - Fixed in: `apps/api/src/modules/chat-requests/chat-requests.controller.ts`
  - Fixed in: `apps/api/src/modules/sessions/sessions.controller.ts`

- **(MINOR-3) ~~`DELETE /push-tokens/:token` has no ownership check.~~ CLOSED in Wave 19 (2026-05-13).** `PushTokensService.unregister()` now scopes the delete to `{ token, userId }`. Controller passes `req.user.sub`. PUSH-7 E2E test validates cross-user no-op behaviour.
  - Fixed in: `apps/api/src/modules/push-tokens/push-tokens.service.ts`
  - Fixed in: `apps/api/src/modules/push-tokens/push-tokens.controller.ts`
  - Test: `apps/web/e2e/api/push-tokens.spec.ts` PUSH-7

### DOCUMENTATION / COVERAGE GAPS

- **(GAP-1) `GET /admin/users` returns `phone` and `email`.** This is spec-correct (admin sees PII). The spec states admins can view user PII. Correctly guarded by `@Roles(ADMIN)`. However, the admin user-list response currently includes all users up to 200 rows with phone/email. Recommend pagination or explicit documentation in the endpoint comment that this is intentional admin-only PII exposure.

- **(GAP-2) E2E coverage missing for several MENTOR-only routes.** `GET /mentors/mentees`, `PATCH /me/mentor/availability`, `PATCH /sessions/requests/:id/decline`, `PATCH /chat-requests/:id/accept`, `PATCH /chat-requests/:id/decline` have no E2E tests verifying that an ASPIRANT receives 403. `api/sessions.spec.ts SES-7` covers the accept case but decline is untested.

- **(GAP-3) `GET /admin/audit-logs` has no E2E test.** The endpoint exists and is guarded but is not covered in any spec file.

- **(GAP-4) `GET /admin/mentors/pending`, `POST /admin/mentors/:id/approve`, `POST /admin/mentors/:id/reject`, `POST /admin/mentors/:id/ban` have no E2E tests.**

---

## Recommendations

1. **MINOR-1 — simulate-success:** Wrap the endpoint in a guard that checks `process.env.NODE_ENV !== 'production'` at the NestJS layer (not inside the service), or conditionally exclude the route via module-level logic. Service-level guard is a single point of failure.

2. ~~**MINOR-2 — list routes without @Roles:** Add `@Roles(Role.MENTOR, Role.ASPIRANT)` to `GET /chat-requests` and `GET /sessions/requests` to make role intent declarative and prevent admin access to role-branched service logic.~~ DONE (Wave 19).

3. ~~**MINOR-3 — push-token deletion:** Add `WHERE userId = authenticatedUserId` to the `unregister()` service call so only the token owner can delete it.~~ DONE (Wave 19).

4. **GAP-2 — MENTOR-only 403 tests:** Add Playwright tests asserting ASPIRANT receives 403 on `PATCH /sessions/requests/:id/decline`, `PATCH /chat-requests/:id/accept`, `PATCH /chat-requests/:id/decline`, and `GET /mentors/mentees`.

5. **GAP-3/4 — Admin endpoint tests:** Add E2E coverage for `GET /admin/audit-logs`, `GET /admin/mentors/pending`, and the mentor approve/reject/ban flow.

---

---

## Closed in Wave 19 (2026-05-13)

| Finding | Status | Commit |
|---------|--------|--------|
| MINOR-2 — No `@Roles()` on list endpoints | CLOSED | `security: declarative role gates + push-token ownership` |
| MINOR-3 — Push-token cross-user deletion | CLOSED | `security: declarative role gates + push-token ownership` |

Both fixes verified via TypeScript typecheck (`cd apps/api && pnpm typecheck`). PUSH-7 E2E spec added to confirm MINOR-3 ownership behaviour is regression-proof.

*Audit performed: 2026-05-13. Auditor: reviewer agent. Read-only — no files modified.*
*Wave 19 fixes applied: 2026-05-13. Engineer: backend agent.*
