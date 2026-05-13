# Wave 5 Review — 2026-05-13

## Summary

YELLOW. 0 CRITICAL, 5 MAJOR, 4 MINOR issues found across 3 commits (f85d2e1, 9064841, b4a3fa6). All three typechecks pass cleanly. The web production build succeeds (33/33 pages). The anonymity contract is upheld throughout: phone/email only surfaces in the admin-only `getUser` route, and report/mentee serialization uses only display handles + avatars. The most impactful issues are: SUSPEND action in moderation logs `BAN_MENTOR`/`BAN_ASPIRANT` instead of a `SUSPEND`-appropriate enum value (schema has no SUSPEND enum), DISMISS action writes no ModerationActionLog row (spec says it should for audit trail), the banned-user OTP banner is reachable by `BANNED` users because `verifyOtp` does not check `BANNED` status, and a double-trigger risk on the 402 interceptor in the save-from-chat flow.

---

## Typecheck and Build Results

```
cd /root/Mento/apps/api  && pnpm typecheck  → exit 0 (clean)
cd /root/Mento/apps/web  && pnpm typecheck  → exit 0 (clean)
cd /root/Mento/apps/mobile && pnpm typecheck → exit 0 (clean)
cd /root/Mento/apps/web  && pnpm build     → exit 0 (33/33 pages generated)
```

No TS6133 unused-import errors. No build failures.

---

## CRITICAL

None.

---

## MAJOR

### [M1] moderation.service.ts:169-174 — SUSPEND action logs `BAN_MENTOR`/`BAN_ASPIRANT` (wrong enum value)

**Issue:** The `moderationActionMap` in `resolveReport` maps `ResolveAction.SUSPEND` to `ModerationAction.BAN_MENTOR` or `ModerationAction.BAN_ASPIRANT`. The `ModerationAction` enum in schema.prisma has only `WARN`, `BAN_ASPIRANT`, `BAN_MENTOR`, and `BAN_BOTH` — there is no `SUSPEND` value. The code is technically valid (it picks one of the existing enum values) but semantically wrong: the audit log entry will say the user was _banned_ when they were only _suspended_. An auditor later reading `moderationActionLog` cannot distinguish a suspension from a ban, which corrupts the moderation history.

**Impact:** Audit trail integrity — suspension events are permanently mis-labeled as bans. Downstream tooling or reporting that reads `ModerationActionLog` will over-count bans.

**Fix:** Either add a `SUSPEND` value to the `ModerationAction` enum in schema.prisma (and run `prisma db push`), or log `ModerationAction.WARN` for a suspension. The same wrong mapping appears in `setUserStatus` at lines 358-365.

---

### [M2] moderation.service.ts:160-163 — DISMISS writes no ModerationActionLog row

**Issue:** When `action === ResolveAction.DISMISS`, the function marks the report as `REVIEWED_NO_ACTION` and returns immediately (line 162: `return`). It writes to `auditLog` only for WARN/SUSPEND/BAN, not for DISMISS. The spec section 1.10 requires every moderation action including dismissals to be auditable. No `ModerationActionLog` row and no `auditLog` row is created for DISMISS.

**Impact:** Dismissed reports are not traceable — admins cannot see who dismissed a report or when. If a pattern of targeted harassment is dismissed repeatedly, there is no audit trail.

**Fix:** Before the early `return`, add an `auditLog.create` (and optionally a `ModerationActionLog.create` with `action: ModerationAction.WARN` as a "no action" marker) so that every resolution is recorded.

---

### [M3] apps/api/src/modules/auth/auth.service.ts:92-109 — BANNED users can obtain tokens via OTP verify

**Issue:** `verifyOtp` checks for `SUSPENDED` at line 104 and throws `UnauthorizedException('Account suspended')`. However it has no check for `BANNED`. A banned user whose phone is not deleted can receive an OTP, submit it, and receive valid access+refresh tokens. The `refresh` path (line 137) does check `status !== ACTIVE` and would block re-use, but the initial `verifyOtp` session is already issued.

**Impact:** Banned users get a short-lived access window (token TTL) after receiving an OTP — they can send messages and perform actions until the access token expires. The ban is not fully effective until the token expires.

**Fix:** Add `else if (user.status === UserStatus.BANNED) { throw new UnauthorizedException('Account banned') }` in `verifyOtp` (and `googleSignIn` which has the same gap at line 78 where only `SUSPENDED` is checked).

---

### [M4] apps/web/app/(app)/chat/[id]/page.tsx:210-215 — Double-handling of 402 in SaveToJournalDialog

**Issue:** The `handlePick` function in `SaveToJournalDialog` catches a 402 error and calls `onClose()` silently (line 213-214), under the assumption that "the global interceptor handles it". The `ApiClient` constructor's `afterResponse` hook does call `opts.onPaymentRequired?.()` which opens the paywall modal. However the error is also re-thrown by ky after the hook runs, meaning the `catch` block in `handlePick` receives it and swallows it after calling `onClose()`. The paywall modal does open, but the dialog also closes — which is fine. The real risk: if the `onPaymentRequired` callback is not wired on the particular `ApiClient` instance used in this route (e.g., a race during hydration before the global interceptor is registered), the 402 is silently swallowed with zero user feedback.

**Impact:** In the edge case where the paywall interceptor is not yet registered, PRO gating silently fails with no UI feedback — the user believes saving succeeded.

**Fix:** Instead of relying on the global interceptor, explicitly call `onError(MENTEES_COPY.saveJournalProRequired)` on 402 (with a paywall open alongside), or ensure the `getApiClient()` factory always registers `onPaymentRequired` before any 402 can be received.

---

### [M5] apps/web/app/(auth)/otp/page.tsx:101-108 — Suspended banner logic has a redundant double-check that silently swallows BANNED errors

**Issue:** The suspended detection logic at lines 102-108 is:
```typescript
const isSuspended =
  err instanceof Error &&
  (err.message.toLowerCase().includes('suspended') ||
    (err as ...).response?.status === 401)
if (isSuspended && err instanceof Error && err.message.toLowerCase().includes('suspended')) {
  setSuspended(true)
  return
}
```
`isSuspended` is true if the message includes "suspended" OR the HTTP status is 401. But the second `if` requires `isSuspended && message.includes('suspended')`. This means a plain 401 with a message that does NOT include "suspended" (e.g., "Account banned", "User not active", "Invalid code") sets `isSuspended = true` but then falls through the second condition and calls `setError(te('otpWrongCode'))`. A banned user who enters a correct OTP sees "Wrong code" — a confusing and incorrect error message.

**Impact:** Banned users (once M3 above is fixed) see the wrong error copy. Even without M3, if the API returns a non-"suspended" 401 message for any reason, the user sees "Wrong code" instead of the real error.

**Fix:** Simplify to check only the message content: `if (err instanceof Error && err.message.toLowerCase().includes('suspended')) { setSuspended(true); return }`. Separately handle banned: `if (err instanceof Error && err.message.toLowerCase().includes('banned')) { /* show banned copy */ }`. Remove the HTTP-status-401 branch from `isSuspended`.

---

## MINOR

### [m1] moderation.service.ts:16-26 — `anonymizeUser` omits `hasPurpleTick`

`anonymizeUser` returns `{ id, displayHandle, avatarLetter, avatarColor }` but not `hasPurpleTick`. The frontend's `ReportSummary` and `ReportDetail` types also omit `hasPurpleTick` for reporter/target. The counterpart serialization convention requires `hasPurpleTick`. The `LetterAvatar` component expects it. This means verified mentor avatars in the moderation queue will not show the purple tick.

**Fix:** Add `hasPurpleTick: user.profile?.hasPurpleTick ?? false` to `anonymizeUser`, and add `hasPurpleTick: boolean` to the frontend types.

---

### [m2] apps/api/src/modules/mentors/mentors.service.ts:69-75 — `listMentees` includes ALL conversations regardless of status

`listMentees` queries all `Conversation` rows where `mentorId` matches, with no filter on the conversation `status` or the aspirant's user `status`. A BANNED or SUSPENDED aspirant will still appear in the mentor's mentee list. The aspirant's user record is fetched but not filtered.

**Fix:** Add `aspirant: { status: 'ACTIVE' }` (or equivalent) to the `where` clause, or at least filter out deleted/banned aspirants in the `results.map`.

---

### [m3] apps/web/app/(app)/chat/[id]/page.tsx:533 — `console.error` left in production send path

At line 533:
```typescript
(res) => {
  if (!res.ok) console.error('send failed:', res.error)
}
```
`console.error` in the socket ack callback will appear in production browser consoles. This is a minor information leak (exposes internal error string) and violates the no-console rule.

**Fix:** Remove or replace with a toast notification on send failure.

---

### [m4] docs/REVIEW_WAVE5.md — Wave 4 fix b4a3fa6: `isDev()` in subscriptions is correct but the DISMISS audit-log gap it didn't address

This is a meta-note: commit b4a3fa6 correctly fixed M1 (`isDev()` now returns `false` in production regardless of key absence), M2 (notification listener is properly registered inside `useEffect` in `_layout.tsx`), M3 (5-pending cap runs the count query before the transaction), M4 (availability page fetches via `user.id` with error fallback), and m5 (`exit 1` is present in both wait-loops in CI). All five Wave 4 fixes are verified correct. No regressions introduced by b4a3fa6.

---

## What's clean

- All three typechecks pass with zero errors, including TS6133.
- Web production build succeeds; all 33 pages generated.
- **Anonymity contract is upheld**: `phone`/`email` appear only in `ModerationService.getUser()`, which is behind `@Roles(Role.ADMIN)`. Reports list and detail use `anonymizeUser`. Mentee list serializes only `{ id, displayHandle, avatarLetter, avatarColor, hasPurpleTick }` (no PII).
- **Aadhaar handling**: hash is computed from `userId:aadhaarLast4` before storage; plaintext never stored in `MentorDenylist`; `getUser` returns only `aadhaarHashSuffix` (last 4 of the hash); `MentorDenylist.aadhaarHash` is the `@id`; denylist check fires in `submitVerification` before any persistence.
- **BAN action**: correctly flips status to BANNED, revokes all refresh tokens (`updateMany where revokedAt null`), deletes push tokens, and upserts `MentorDenylist` (only if `verification.aadhaarHash` is present).
- **Guard order**: `JwtAuthGuard` is registered before `RolesGuard` via `APP_GUARD` in `auth.module.ts`. A request to an `@Roles(Role.ADMIN)` route without a token gets a 401 from `JwtAuthGuard` first; `RolesGuard` throws 403 only when authenticated but wrong role. This is the correct behavior.
- **chat.gateway.ts:handleConnection**: correctly fetches `user.status` after JWT verification and disconnects if `!user || user.status !== ACTIVE`. No crash when user is missing (guarded by the falsy check on `!user`).
- **Mobile tabs**: `href: isMentor ? null : undefined` correctly hides the Mentees tab from aspirants and the Mentors tab from mentors.
- **SaveToJournalDialog** fetches only non-shared, non-locked journals (`filter(j => !j.isShared && !j.isLocked)`), which is the correct gate.
- **Wave 4 fixes (b4a3fa6)**: all five reviewer findings from Wave 4 are correctly addressed. No regressions.
- **PRO gate on save-from-chat**: `@MinTier(SubscriptionTier.PRO)` decorator is applied at controller level; the `TierGuard` will return 402 for FREE/BASIC users before the service method runs.
- **`console.log`**: only in `apps/api/src/main.ts` (startup banner, acceptable) and `apps/mobile/lib/push.ts` (debug logging, low severity). No `console.log` in hot paths.
- **CI yaml**: both wait-loops have `exit 1` at the end.
