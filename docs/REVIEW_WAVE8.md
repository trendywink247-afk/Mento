# Wave 8 Review — 2026-05-13

## Summary

VERDICT: CONDITIONAL PASS with 1 MAJOR and 3 MINOR issues.
All three typechecks pass clean. The web production build succeeds and emits the
three new legal routes. The API test suite is green (115/115). The env var rename
is complete in all CI/CD and infra files. The primary concern is that the claimed
pull-to-refresh fix is structurally incomplete — the spinner still stops before
data arrives, because `load()` does not return its Promise chain.

---

## Build / typecheck / test results

| Check | Result |
|---|---|
| `cd apps/web && pnpm typecheck` | PASS (0 errors) |
| `cd apps/mobile && pnpm typecheck` | PASS (0 errors) |
| `cd apps/api && pnpm typecheck` | PASS (0 errors) |
| `cd apps/web && pnpm build` | PASS — 38 routes, /privacy + /terms + /refund-policy all appear |
| `cd apps/api && pnpm test` | PASS — 5 files, 115 tests |

Web route count: 38 (was 35 before Wave 8 — three legal routes added).

---

## CRITICAL

None.

---

## MAJOR

### MAJOR-1: pull-to-refresh fix is incomplete — spinner stops before data arrives

The commit message claims "spinner reflects actual load time" but the fix does not
achieve this. The `load` function declared at line 470 of
`/root/Mento/apps/mobile/app/(tabs)/chat/index.tsx` uses `useCallback` and returns
`void`:

```ts
const load = useCallback(() => {
  setError(null)
  Promise.all([...])
    .then(([c, r]) => { ... })
    .catch(...)
  // ← no return statement; Promise chain is fire-and-forget
}, [])
```

Every `onRefresh` handler in the file now does:
```ts
setRefreshing(true)
try {
  await load()          // await void === await undefined → resolves instantly
} finally {
  setRefreshing(false)  // fires on the next microtask, NOT after fetch completes
}
```

`await undefined` resolves on the next microtask tick — well before the
`Promise.all` inside `load()` settles. This is strictly better than the old code
(which called `setRefreshing(false)` synchronously on the next line), but only
because the microtask boundary gives React one render cycle. In practice the
spinner still disappears before the network response arrives.

The correct fix is either:
- Make `load()` return the `Promise.all(...)` chain, or
- Inline the fetch logic into `onRefresh` as a proper `async` function.

This affects all 4 pull-to-refresh handlers (tabs: all, pending, sent, archived).

---

## MINOR

### MINOR-1: `.env.prod.example` still references old `NEXT_PUBLIC_API_URL`

`/root/Mento/.env.prod.example` (line 47) still contains:
```
NEXT_PUBLIC_API_URL=https://api.mento.in
```

The file was not included in this commit. Any operator who copies
`.env.prod.example` → `.env.prod` will define the old variable name.
`docker-compose.prod.yml` now reads `${NEXT_PUBLIC_API_BASE_URL:-https://api.mento.in}`,
so the default kicks in and production deployment to `mento.in` still works.
However, a staging deployment or a custom domain would silently ignore the
operator-supplied value and fall back to the hardcoded default.

The file must be updated to `NEXT_PUBLIC_API_BASE_URL=https://api.mento.in`.

### MINOR-2: `prose` class on legal layout is a no-op — `@tailwindcss/typography` is not installed

`/root/Mento/apps/web/app/(legal)/layout.tsx` applies
`prose prose-slate dark:prose-invert` to the `<main>` wrapper. The Tailwind
config at `/root/Mento/apps/web/tailwind.config.ts` only registers
`tailwindcss-animate`; `@tailwindcss/typography` is absent from both the plugin
list and `package.json`. The build does not error (Tailwind silently ignores
unknown class names), but all legal pages render as unstyled body text with no
typographic hierarchy: headings are the same size as paragraphs, lists have no
indentation, and links have no color treatment.

Not a blocker for legal compliance, but the pages look unpolished. Either install
`@tailwindcss/typography` or replace `prose` with explicit utility classes.

### MINOR-3: Unused `opacity` shared value in `SkeletonRow` — logic bug masked by loose tsconfig

In `SkeletonRow` (line 234, same file as MAJOR-1):
```ts
const opacity = useSharedValue(0.4)   // declared but never read
const animStyle = useAnimatedStyle(() => ({
  opacity: interpolate(Math.sin(Date.now() / 600), [-1, 1], [0.4, 0.8], ...),
}))
```

The `opacity` shared value is allocated but the `useAnimatedStyle` callback reads
`Math.sin(Date.now() / 600)` directly instead of `opacity.value`. This means the
animation produces a static value computed once at mount time, not a live shimmer.
The skeleton renders but does not pulse. Additionally, Reanimated worklets that
read `Date.now()` on the JS thread without a driving animation loop will not
update — the shimmer effect is fully broken.

This was pre-existing code not introduced by Wave 8, but the Wave 8 diff touched
this file, making it visible to review. It will not be caught by the mobile
typecheck because `expo/tsconfig.base.json` does not set `noUnusedLocals: true`.

---

## What's clean

- **Env var rename**: complete in all four target files (`Dockerfile.web`,
  `docker-compose.prod.yml`, `deploy.yml`, `ci.yml`). All `NEXT_PUBLIC_API_BASE_URL`
  references in `apps/web/lib/api.ts`, `apps/web/lib/socket.ts`, and the two
  server components are consistent with the renamed variable.
- **New docker-compose.prod.yml env vars**: all three map correctly to their
  consumers. `RAZORPAY_PLAN_${tier}` matches `planIdForTier()` in
  `subscriptions.service.ts`. `EXPO_ACCESS_TOKEN` matches
  `notifications.service.ts:52`. `SOCKET_REDIS_ADAPTER` is read with
  `!== 'true'` string comparison at `chat.gateway.ts:61` and the compose default
  of `true` is correct for prod horizontal scaling. Redis URL is also already
  present in compose, satisfying the `createAdapter` call that follows the guard.
- **Legal pages build and route correctly**: `/privacy`, `/terms`,
  `/refund-policy` all appear in the Next.js route table. The `(legal)` route
  group correctly strips the directory name from URLs.
- **LandingFooter uses Next.js `Link`**: all three legal hrefs go through the
  `<Link>` component, not raw `<a>` tags.
- **Legal layout navigation**: the shared header links back to `/` and provides
  cross-links to all three legal pages using `next/link`.
- **Privacy page content**: covers phone, email, Google sign-in, Aadhaar
  (hash retained on ban), journals, messages, PostHog (with autocapture-off note),
  Sentry (PII-redacted), Razorpay card handling, data retention (30-day erasure),
  Aadhaar denylist exception, and a contact email (`privacy@mento.in`). Passes the
  content checklist from the audit brief.
- **Terms page content**: covers anonymity rule, mentor responsibilities (good
  faith, off-platform ban), aspirant responsibilities, prohibited conduct
  (5-point list including denylist), and subscription/refund cross-link.
- **Refund policy content**: 7-day first-time refund window, session refunds
  deferred to v1.1 (August 2026), non-refundable list (used days, post-window
  cancellations, banned accounts).
- **No console.log** in any Wave 8 touched file.
- **Anonymity invariant**: legal pages contain no phone/email/real-name exposure.
- **No hardcoded colors** in legal pages or layout (uses `bg-background`,
  CSS-variable-based classes).
