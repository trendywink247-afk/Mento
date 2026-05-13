# Wave 13 Review — 2026-05-13

## Summary

**VERDICT: BLOCKED — 1 CRITICAL, 0 MAJOR, 2 MINOR.**

The lockfile is out of sync with package.json: `@nestjs/schedule` was added to `apps/api/package.json` but `pnpm-lock.yaml` was never updated. `pnpm install --frozen-lockfile` in the Dockerfile will fail, blocking all Docker CI/CD builds. Everything else is clean.

---

## CRITICAL

### C1 — `@nestjs/schedule` absent from `pnpm-lock.yaml` — Docker build will fail

**Commit:** `da593bc` (Wave 12 fix for schedule dep — the fix is incomplete)

**Evidence:**
- `apps/api/package.json` line 34: `"@nestjs/schedule": "^4.1.0"` — present.
- `pnpm-lock.yaml` `apps/api` importer section: `@nestjs/schedule` does not appear at all. Confirmed by exhaustive search: zero matches for the string `@nestjs/schedule` in the 667 KB lockfile.
- The package physically exists in the pnpm content-addressed store at `.pnpm/@nestjs+schedule@6.1.3_...` — meaning `pnpm install` was run without `--frozen-lockfile` locally, so local dev works, but the store entry is not reflected in the lockfile.
- `infra/docker/Dockerfile.api` line 27: `RUN pnpm install --frozen-lockfile` — this step will error with "ERR_PNPM_OUTDATED_LOCKFILE" at Docker build time.
- The package is actively used: `apps/api/src/modules/nudges/nudges.module.ts` imports `ScheduleModule` and `apps/api/src/modules/nudges/nudges.service.ts` uses `@Cron` — without the package the NestJS app cannot start.

**Fix required:** `pnpm install` (without `--frozen-lockfile`) then commit the updated `pnpm-lock.yaml`.

---

## MAJOR

None.

---

## MINOR

### M1 — Web build emits a Sentry compile warning

**File:** `apps/web/app/error.tsx`

Next.js emits `"Critical dependency: require function is used in a way in which dependencies cannot be statically extracted"` originating from `require-in-the-middle` inside `@sentry/nextjs`. This is a well-known Sentry + Next.js interaction (the Sentry SDK uses dynamic `require` internally). The build succeeds with exit 0 and all pages compile. No functional impact, but it pollutes CI logs and may be mistaken for a blocking error by reviewers.

**Fix:** Add `serverExternalPackages: ['require-in-the-middle']` to `next.config.ts`, or pin `@sentry/nextjs` to a version that has resolved this.

### M2 — `console.log` in production mobile push handler

**File:** `/root/Mento/apps/mobile/lib/push.ts` lines 19 and 26

Two `console.log` statements left in production push-notification registration path:
- `console.log('[push] Skipping registration — not a physical device')`
- `console.log('[push] Notifications permission not granted')`

These surface in user device logs. Per project convention, `console.log` should not be in production code. Use `pino` / `logger.debug` or remove entirely.

Note: `apps/api/src/main.ts` line 85 has `console.log(\`[api] listening on...\`)` — this is common in server entrypoints and is a lower-priority concern, but worth noting.

---

## What's clean

- **robots.ts** (C2 fix): All real URL prefixes are disallowed (`/login`, `/otp`, `/dashboard`, `/chat`, `/mentors`, `/mentees`, `/journals`, `/calls`, `/wallet`, `/availability`, `/upgrade`, `/admin`, `/api`). Route-group syntax `/(auth)` and `/(app)` are gone. Sitemap pointer correct. No false negatives (public onboarding paths `/pricing`, `/get-app`, `/onboarding/role`, `/privacy`, `/terms`, `/refund-policy` correctly allowed).

- **Invite error narrowing** (C3 fix): `redeemForUser` catch at `invites.service.ts:130–138` correctly uses structural check `(err as { code?: string }).code === 'P2002'` to isolate unique constraint violations, re-throws all other errors. No `Prisma.PrismaClientKnownRequestError` import needed. Logic is sound.

- **EAS / `app.json`** (commit `7bd6a9f`): `eas.json` has 3 build profiles (development, preview, production) plus submit config. `app.json` has `ios.bundleIdentifier: "in.mento.app"`, `android.package: "in.mento.app"`, `notification` plugin with icon path. Plugin list covers `expo-router`, `expo-secure-store`, `expo-notifications`, `expo-linear-gradient`, `expo-splash-screen`. No real Apple Team IDs / credentials committed — all three submit fields are `TODO:` placeholder strings. `google-service-account.json` is referenced in `eas.json` but not committed. `eas.projectId` is a zero-UUID placeholder, not a real project ID. `STORE.md` covers App Store + Play Store listing copy. `store-screenshots/README.md` enumerates 10 screen captures with anonymity constraints respected throughout.

- **PostHog events — ANONYMITY** (commit `4c62d52`): Zero PII leaks found. Source-only search across `apps/web/{app,components,lib}` and `apps/mobile/{app,components,lib}` finds no `capture(` call passing phone, email, displayHandle, aadhaar, googleSub, or real names. `identify()` is called with `session.user.id` (UUID) and `{ role: session.user.role }` (enum) only. Server-side `posthog.service.ts` is no-op when `POSTHOG_PROJECT_KEY` is unset and disabled in test. `autocapture: false` and `capture_pageview: false` on the client. `analytics.ts` helper is SSR-safe (guards with `typeof window !== 'undefined'`). `onboarding/event` endpoint metadata pass-through carries only categorical values (`stage`, `journeyStage`, `role`) — no PII.

- **events.ts parity**: 47 events in `ANALYTICS_EVENTS`. Web and mobile files are byte-identical. `docs/ANALYTICS_EVENTS.md` exists.

- **Server-side OnboardingEvent writes**: Confirmed at all 5 required endpoints:
  - `auth.service.ts:133` — signup
  - `onboarding.service.ts:85` — mirror_completed
  - `onboarding.service.ts:174` — mentor_submitted
  - `chat-requests.service.ts:159` — first_mentor_accepted
  - `subscriptions.service.ts:250` — paid_activated

- **Typechecks**: All three apps pass `pnpm typecheck` with zero errors. API: 0 errors. Web: 0 errors. Mobile: 0 errors.

- **Tests**: 127 tests across 6 suites — all pass.

- **Web build**: Succeeds. All pages compile. Only a non-blocking Sentry warning (M1 above).

