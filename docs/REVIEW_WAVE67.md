# Wave 6+7 Review — 2026-05-13

## Summary

The codebase is in reasonably good shape for an MVP heading to production. TypeScript compiles clean across all three apps (api EXIT:0, web EXIT:0, mobile EXIT:0). The Next.js production build passes (EXIT:0, 33 routes). The 115 Mento API unit tests all pass (5 test files, EXIT:0 via direct vitest invocation). However, there is one critical bug that will silently break the production web app from day one: the Dockerfile and compose pass `NEXT_PUBLIC_API_URL` at build time, but the source code reads `NEXT_PUBLIC_API_BASE_URL`. In production, `lib/api.ts` and `lib/socket.ts` will fall through to `http://localhost:4000` (a dead address inside the container), making the entire web app non-functional. Additionally there are three major issues: a missing env-var from `.env.prod.example`, an unused shared value in the skeleton animator that will cause a TS lint warning (not currently caught because the build passes), and a subtle optimistic-UI race in pull-to-refresh. No anonymity leaks were found; phone/email are never exposed in public routes.

---

## Typecheck / Unit Test / Build Results

| Check | Exit code | Notes |
|---|---|---|
| `apps/api` tsc --noEmit | **0** | Clean |
| `apps/web` tsc --noEmit | **0** | Clean |
| `apps/mobile` tsc --noEmit | **0** | Clean |
| `apps/api` vitest (115 tests, 5 files) | **0** | All pass |
| `apps/web` next build | **0** | 33 routes, all dynamic |

---

## CRITICAL

### CRIT-1 — `NEXT_PUBLIC_API_URL` baked into Docker but code reads `NEXT_PUBLIC_API_BASE_URL`

**Files affected:**
- `/root/Mento/infra/docker/Dockerfile.web` (line 50, 57): `ARG NEXT_PUBLIC_API_URL` / `ENV NEXT_PUBLIC_API_URL=`
- `/root/Mento/infra/docker/docker-compose.prod.yml` (lines 135, 146): `NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-https://api.mento.in}`
- `/root/Mento/apps/web/lib/api.ts` (line 3): `process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'`
- `/root/Mento/apps/web/lib/socket.ts` (line 5): `process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'`
- `/root/Mento/apps/web/components/landing/MentorPreviewSection.tsx` (line 20): same
- `/root/Mento/apps/web/app/page.tsx` (line 15): same

**Impact:** In the Docker image the baked-in `NEXT_PUBLIC_API_URL` is entirely ignored. Every API call and socket connection from the web app falls through to `http://localhost:4000` — which does not exist inside the web container. **The deployed web app will be completely non-functional** (blank dashboard, no auth, no chat). The CI `build-web` job also sets `NEXT_PUBLIC_API_URL` (line 52) and misses this, so it does not catch the bug.

**Fix:** Either rename the ARG/ENV in Dockerfile.web and compose to `NEXT_PUBLIC_API_BASE_URL`, or rename the variable reads in source code to `NEXT_PUBLIC_API_URL`. Also add `NEXT_PUBLIC_API_BASE_URL` to `.env.prod.example`.

---

## MAJOR

### MAJ-1 — `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WEB_BASE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` absent from `.env.prod.example`

**File:** `/root/Mento/.env.prod.example`

`.env.prod.example` documents `NEXT_PUBLIC_API_URL` (the wrong name — see CRIT-1) and `NEXT_PUBLIC_SOCKET_URL` but is missing:
- `NEXT_PUBLIC_API_BASE_URL` — consumed by `lib/api.ts`, `lib/socket.ts`, `app/page.tsx`
- `NEXT_PUBLIC_WEB_BASE_URL` — consumed by `app/layout.tsx` (metadataBase); missing causes OG/Twitter card URLs to be `localhost`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — consumed by `app/(auth)/login/page.tsx`; Google sign-in silently no-ops without it
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — consumed by `app/(app)/upgrade/page.tsx`; without it `isDevMode()` returns `true` in production, allowing anyone to simulate a subscription upgrade

The `isDevMode()` check at line 58 of `/root/Mento/apps/web/app/(app)/upgrade/page.tsx` uses `!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID`. If this key is absent from the baked env, the production paywall bypasses Razorpay entirely and calls `simulate-success` instead — which the server correctly blocks (`isDev()` in `subscriptions.service.ts` checks `NODE_ENV === 'production'` first, so the server-side guard holds). However, the frontend will show a `[Dev]` banner to all production users and error out when the simulate endpoint returns 403. The server-side guard prevents financial fraud but the UX is broken.

### MAJ-2 — Pull-to-refresh does not `await load()` before clearing the spinner

**File:** `/root/Mento/apps/mobile/app/(tabs)/chat/index.tsx` (lines 611-614, 636-639, 661-665, 691-694)

All four `RefreshControl.onRefresh` handlers set `refreshing = true`, call `load()` synchronously (fire-and-forget), then immediately call `setRefreshing(false)`. Because `load()` is async and not awaited, the pull-to-refresh spinner disappears the moment the API call is initiated, not when it completes. On slow connections the list will appear to have refreshed successfully before data arrives. The pattern should be:
```ts
onRefresh={async () => {
  setRefreshing(true)
  await new Promise<void>((resolve) => {
    const orig = load  // wrap load to resolve when state updates
    // simplest fix: await a Promise that resolves when load() calls its setState
  })
  setRefreshing(false)
}}
```
Or simplest fix: refactor `load` to return a Promise and `await load()`.

### MAJ-3 — `SkeletonRow` declares an unused `opacity` shared value

**File:** `/root/Mento/apps/mobile/app/(tabs)/chat/index.tsx` (line 234)

```ts
const opacity = useSharedValue(0.4)
```
`opacity` is never read — the `useAnimatedStyle` block computes opacity from `Math.sin(Date.now() / 600)` directly without referencing `opacity`. This is an unused variable. The TypeScript compiler does not flag it (React Native Reanimated shared values are not recognized as dead by tsc), but it is a resource leak (every `SkeletonRow` instance allocates a Reanimated shared value on the native side and never frees it via the returned cleanup). When there are 4 skeleton rows, that is 4 leaked native worklets. Also, the animation will not actually animate — `Math.sin(Date.now() / 600)` is computed once at mount time and never re-evaluated unless `useAnimatedStyle` is driven by a reactive dependency. The skeleton will render at a fixed opacity rather than pulsing.

---

## MINOR

### MIN-1 — `console.log` in production push registration

**File:** `/root/Mento/apps/mobile/lib/push.ts` (lines 19, 26)

```ts
console.log('[push] Skipping registration — not a physical device')
console.log('[push] Notifications permission not granted')
```
These should be `console.warn` or guarded by `__DEV__`. In production EAS builds `console.log` output persists in device crash logs and can expose diagnostic information. `console.warn` on the non-device path is benign noise; the real issue is the permission-denied path being silently logged without surfacing to the user (a no-op is acceptable, but `console.warn` would be better signaling).

### MIN-2 — `verifyOtp` in `auth.service.ts` checks status order differently from `googleSignin`

**File:** `/root/Mento/apps/api/src/modules/auth/auth.service.ts` (lines 94-113)

`verifyOtp` checks `PENDING_VERIFICATION` first and activates the user, THEN checks `SUSPENDED`/`BANNED`. `googleSignin` checks `SUSPENDED`/`BANNED` first, THEN `PENDING_VERIFICATION`. For `verifyOtp`, a user who is simultaneously `SUSPENDED` and `PENDING_VERIFICATION` (which should not happen in practice, but defensive coding matters) would be activated instead of rejected. The order should be: SUSPENDED → BANNED → PENDING_VERIFICATION → (activate) → issue tokens. Tests do cover the `SUSPENDED`/`BANNED` paths so in practice the tested order is: if the user exists as PENDING_VERIFICATION with no other status, activation occurs; separate DB paths for SUSPENDED and BANNED are checked after. In the current code flow it is actually correct because `PENDING_VERIFICATION` branch has an early `user = await prisma.user.update(...)` and then falls through to `issueTokens`, while `SUSPENDED`/`BANNED` use `throw` — but the ordering means if a future developer adds an `else if` chain they may miss this subtlety. Low actual risk given the Prisma schema enforces a single status enum value.

### MIN-3 — `isDevMode()` in upgrade page does not guard against empty-string `NEXT_PUBLIC_RAZORPAY_KEY_ID`

**File:** `/root/Mento/apps/web/app/(app)/upgrade/page.tsx` (line 58)

```ts
return !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
```
If `.env.prod.example` instructs operators to set `NEXT_PUBLIC_RAZORPAY_KEY_ID=` (empty string), `!''` is `true`, triggering dev mode in production. The server-side guard on `simulate-success` (`NODE_ENV === 'production'` check in `subscriptions.service.ts` line 27) correctly blocks it, so no financial bypass is possible, but the UX breaks. A safer check would be `!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim()`.

### MIN-4 — Caddyfile missing `Content-Security-Policy` header

**File:** `/root/Mento/infra/docker/Caddyfile`

The security headers block for both `api.mento.in` and `mento.in` includes HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and `-Server` (removes Server header). However, no `Content-Security-Policy` is set. For an app handling auth tokens and payments this is a gap, especially for the web frontend. Recommended to add at minimum `default-src 'self'; script-src 'self' https://checkout.razorpay.com 'unsafe-inline'; connect-src 'self' https://api.mento.in wss://api.mento.in`.

### MIN-5 — `PillTabBar` touch targets are 36px, below 44px minimum

**File:** `/root/Mento/apps/mobile/app/(tabs)/chat/index.tsx` (line 111)

```ts
minHeight: 36,
```
The WCAG 2.5.5 and Apple HIG guideline is 44pt minimum for touch targets. The pill tabs are set to `minHeight: 36` which is below the threshold. On small iPhone SE screens the hit area will be difficult to tap. Should be `minHeight: 44`.

### MIN-6 — `DowngradeModal` visible to FREE users if `currentTier` initialization races

**File:** `/root/Mento/apps/web/app/(app)/upgrade/page.tsx` (line 271)

```tsx
{currentTier !== 'FREE' && (...)}
```
`currentTier` is initialized to `'FREE'` (line 72) and then fetched asynchronously. The downgrade section is correctly hidden for FREE users. However, the `setCurrentTier` is only called on mount after `subscriptions.me()` resolves. If the API call fails (line 87, `.catch(() => {})`), `currentTier` stays `'FREE'` — which is the safe fallback. This is fine, just noting the silent swallow means a real paid user who has a network hiccup on load won't see the downgrade option. Low priority.

### MIN-7 — `auth.service.ts` `verifyOtp` does not short-circuit for `BANNED` before `PENDING_VERIFICATION`

Already documented as MIN-2 above (duplicate finding merged).

### MIN-8 — `refreshToken.updateMany` in `verifyOtp` path — no revocation on re-auth for BANNED user

`verifyOtp` throws `UnauthorizedException` for BANNED users but does not call `updateMany` to revoke any outstanding refresh tokens. The `moderation.service.ts` `resolveReport` path does revoke tokens at ban time. But if a BANNED user somehow still has a valid refresh token in flight (e.g., ban happened between access and refresh), `/auth/refresh` will correctly reject them via the `user.status !== ACTIVE` check in `auth.service.ts` line 141. The guard is there. Not a security hole but worth noting.

---

## What's Clean

- **Anonymity**: `chat.service.ts`, `moderation.service.ts`, `sessions.service.ts`, `chat-requests.service.ts` all return only `{id, displayHandle, avatarLetter, avatarColor, hasPurpleTick}` for counterparts. Phone and email are stripped in every public response. The `getUser` admin-only endpoint correctly returns phone/email but is gated by RBAC. E2E tests at `/root/Mento/apps/web/e2e/api/moderation.spec.ts` assert `+91`, `@`, and `"phone"` patterns do not appear in JSON responses.

- **DISMISS short-circuit**: `/root/Mento/apps/api/src/modules/moderation/moderation.service.ts` lines 193-196 — the `if (action === ResolveAction.DISMISS || action === ResolveAction.WARN) return` is correctly placed after `moderationActionLog.create` and `auditLog.create` but before `user.update`, `refreshToken.updateMany`, and `pushToken.deleteMany`. The audit trail is written for DISMISS; the user status is not changed. Unit test at `moderation.service.spec.ts` line 141-149 verifies this.

- **ModerationAction enum**: All six values (`WARN`, `DISMISS`, `SUSPEND_ASPIRANT`, `SUSPEND_MENTOR`, `BAN_ASPIRANT`, `BAN_MENTOR`) are present in the migration SQL (lines 112-121) using a `DO $$` guard. The service correctly maps `ResolveAction.SUSPEND` to `SUSPEND_ASPIRANT` vs `SUSPEND_MENTOR` based on `targetUser.role`.

- **Seed promotes existing user**: `/root/Mento/apps/api/prisma/seed.ts` lines 22-29 — correctly detects an existing user (created by OTP-verify as ASPIRANT) and calls `prisma.user.update` to promote them to `ADMIN`. The `if` check on line 18 prevents re-running unnecessarily.

- **verifyOtp + googleSignin reject BANNED**: Both paths in `auth.service.ts` explicitly throw `UnauthorizedException('Account banned')` and `UnauthorizedException('Account suspended')`. The OTP page in `/root/Mento/apps/web/app/(auth)/otp/page.tsx` lines 104-108 matches on `msg.includes('suspended') || msg.includes('banned')` before showing the banner, correctly distinguishing from a wrong-code 401 (which shows the "wrong code" error instead).

- **`isDev()` in subscriptions.service.ts**: Correctly gates `NODE_ENV === 'production'` first (line 27), so `simulate-success` is unconditionally blocked in production even if `RAZORPAY_KEY_ID` is absent.

- **Dockerfile.api**: Non-root user (`appuser`), tini for PID 1, Prisma engines copied via `prisma/` directory, no secrets baked in, healthcheck on `/healthz`. Clean.

- **docker-compose.prod.yml**: Postgres and Redis not exposed on host ports (only on `mento_internal` network). All four services have correct healthchecks. Named volumes for postgres data, redis data, caddy data, caddy config.

- **Caddyfile**: Auto TLS (ACME), HSTS with preload, X-Frame-Options DENY, `-Server` header removal, admin interface disabled. Cache-Control correctly differentiates hashed static assets (immutable) from HTML (no-cache). HSTS max-age is 1 year (31536000). HTTP/3 via UDP port 443.

- **CI sourcemap gating**: `/root/Mento/.github/workflows/ci.yml` lines 79-82 — all three conditions (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` non-empty) must be true for the upload step to run. Correctly skipped in forks.

- **5-pending cap for sessions**: Checked before the `$transaction` in `sessions.service.ts` lines 86-91. The count query is outside the transaction, which avoids locking the table but means there is a theoretical TOCTOU race under extreme concurrency. For MVP with low concurrency this is acceptable. Unique constraint on the DB side would be needed for strict enforcement.

- **Foreground push listener**: `/root/Mento/apps/mobile/app/_layout.tsx` lines 71-88 — `addNotificationReceivedListener` is attached in `useEffect` and correctly cleaned up via the returned `.remove()` call in the cleanup function. `addNotificationResponseReceivedListener` similarly cleaned up. Both listeners are only attached when the component mounts (once per app lifecycle).

- **Search-in-thread (no XSS)**: `/root/Mento/apps/mobile/app/(tabs)/chat/[id].tsx` — `HighlightText` component splits text into parts and renders each as a `<Text>` JSX element. No `dangerouslySetInnerHTML` is used. The `__html` pattern was found only in `/root/Mento/apps/web/app/layout.tsx` line 68 as a Flash-Of-Incorrect-Theme prevention inline script (a standard technique, content is hardcoded not user-derived).

- **Swipe-archive revert path**: `archiveConversation` and `archiveRequest` in `chat/index.tsx` both apply optimistic updates then call the API. On API failure, the catch block calls `load()` which re-fetches from server, correctly reverting the optimistic state. The only issue is the `showToast` fires before knowing the API succeeded — acceptable UX tradeoff for MVP.

- **iOS toast**: `showToast()` is guarded with `Platform.OS === 'android'` — on iOS it is a no-op (no crash).

- **Migration SQL**: All new ENUMs use `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` guards. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` used throughout. `CREATE TABLE IF NOT EXISTS` for new tables. Drop-and-recreate used for Profile and MentorProfile (risky on live prod data but acceptable for a Phase A migration where the old schema was incompatible). The migration doesn't conflict with the init migration — it drops old tables before recreating.

- **Unit test quality**: `auth.service.spec.ts` (19 tests) correctly reproduces `hashRefreshToken` logic to generate test fixtures. `moderation.service.spec.ts` (24 tests) uses a `$transaction` mock that routes to a `txMock` sub-object, accurately reflecting the real `$transaction(async tx => ...)` pattern. `tier.guard.spec.ts` (12 tests) mocks Reflector and SubscriptionsService cleanly. `anonymity.spec.ts` (40 tests) achieves good coverage of all letter/color/handle generation paths.

- **tier-changed event listener cleanup**: `/root/Mento/apps/web/app/(app)/layout.tsx` lines 77-78 — `window.addEventListener` is balanced by `window.removeEventListener` in the `useEffect` cleanup. No leak.

- **Downgrade modal cannot be triggered for FREE**: The button is inside `{currentTier !== 'FREE' && ...}` (line 271). Since `currentTier` initializes to `'FREE'` and only changes on successful API fetch, a FREE user will never see the downgrade button.

- **`tabIndex={-1}` a11y fix**: `/root/Mento/apps/web/app/(app)/layout.tsx` line 254 — the tier badge `<Link>` is `tabIndex={-1}` and `aria-hidden="true"`, which removes it from the keyboard tab order. The surrounding `<button>` (line 266) provides keyboard access to the user menu, which includes navigation to `/upgrade`. This is acceptable — the tier badge is a cosmetic affordance for mouse users; keyboard users reach upgrade via the user menu.

