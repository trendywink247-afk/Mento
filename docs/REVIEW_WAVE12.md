# Wave 12 Review — 2026-05-13

## Summary

FAIL — 1 critical, 1 major, 2 minor. TypeScript compiles clean across all three apps. API tests pass (127/127). Web production build passes on a clean `.next` cache. The critical issue (`@nestjs/schedule` undeclared in `package.json`) will break the Docker build on a fresh `pnpm install --frozen-lockfile`. The major issue (robots.txt route-group paths) means auth/app pages are crawlable.

---

## CRITICAL

### C1 — `@nestjs/schedule` not declared in `apps/api/package.json`

`NudgesModule` imports and calls `ScheduleModule.forRoot()` from `@nestjs/schedule`, and `NudgesService` uses `@Cron` decorators. However, `@nestjs/schedule` appears **nowhere** in any `package.json` or `pnpm-lock.yaml` in the repo. The package happens to be present in `apps/api/node_modules/@nestjs/schedule` (v6.1.3) — almost certainly installed ad-hoc without `--save` — but:

- `pnpm install --frozen-lockfile` (used in `Dockerfile.api`) installs only what is in `pnpm-lock.yaml`. `@nestjs/schedule` is absent from the lockfile. The Docker API build will fail with a module-not-found error at compile or startup time.
- A fresh developer checkout (`pnpm install`) will also miss it.

Fix: add `"@nestjs/schedule": "^6.1.3"` (or equivalent) to `apps/api/package.json` dependencies and regenerate the lockfile.

---

## MAJOR

### M1 — `robots.ts` disallows Next.js route-group names, not real URL paths

`/root/Mento/apps/web/app/robots.ts` (lines 19–28) lists `'/(auth)'` and `'/(app)'` in the `disallow` array. These are Next.js file-system route-group folder names; they never appear as URL path prefixes in the generated sitemap or actual HTTP requests. The actual crawlable URLs for those groups are `/login`, `/otp`, `/dashboard`, `/chat`, `/mentors`, `/mentees`, `/journals`, `/wallet`, `/upgrade`, `/calls`, `/availability`. None of these are blocked.

Only `/admin` and `/api` are correctly blocked (they are real path prefixes). Every authenticated page — including the OTP login flow, chat screens, and mentor dashboard — is therefore crawlable by search engines, which:
- Leaks the existence of auth-gated routes to search indexes.
- May expose error pages or redirects for unauthenticated crawlers.

Fix: replace `'/(auth)'` and `'/(app)'` with the real path prefixes (e.g., `'/login'`, `'/otp'`, `'/dashboard'`, `'/chat'`, `'/mentors'`, `'/mentees'`, `'/journals'`, `'/wallet'`, `'/upgrade'`).

---

## MINOR

### m1 — Catch-all swallows non-unique-violation errors in `redeemForUser`

`/root/Mento/apps/api/src/modules/invites/invites.service.ts` lines 125–131:

```typescript
try {
  await tx.inviteRedemption.create({ data: { inviteCodeId: row.id, userId } })
} catch (err) {
  throw new ConflictException('User has already redeemed an invite code')
}
```

`err` is never inspected or logged. Any non-unique-violation DB error (connection drop, schema mismatch, Prisma client error) inside this try block is silently swallowed and reported to the caller as `409 Conflict` with message "User has already redeemed an invite code". This will make debugging production DB issues very difficult. The error should at minimum be re-logged before re-throwing.

### m2 — Stale `.next` cache causes intermittent build failure

During this audit, an initial `pnpm build` in `apps/web` failed with `Cannot find module './625.js'` and `Error [PageNotFoundError]: Cannot find module for page: /onboarding/mentor-welcome`. After clearing the stale `.next` directory the build succeeded (41/41 static pages generated). This is a known Next.js incremental-build cache corruption issue and not a code bug, but it may affect CI pipelines that cache `.next` between runs without a proper cache key on the source hash.

---

## What's clean

- **C1 (module registration)** — `AnalyticsModule` and `FlagsModule` are correctly imported and registered in `AppModule` (lines 100–101). `AnalyticsController` is decorated `@Roles(Role.ADMIN)`. `FlagsPublicController` is `@Public()` and `FlagsAdminController` is `@Roles(Role.ADMIN)`. Both modules export their services.
- **C2 (invite race safety)** — `redeemForUser` uses `tx.$executeRaw` with `WHERE "uses" < "maxUses" AND "disabledAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`. SQL identifiers use double-quotes (PG style), not backticks. `${row.id}` is Prisma parameterized interpolation, not string concatenation. The 0-rows-affected branch throws `GoneException`. The unique-violation branch throws `ConflictException`.
- **Perf indexes** — Migration `20260513010000_perf_indexes_analytics/migration.sql` uses `CREATE INDEX IF NOT EXISTS` with `WHERE "deletedAt" IS NULL` partial predicates. Both `User` and `Message` models have matching `@@index([createdAt(sort: Desc)])` annotations in `schema.prisma`.
- **Mentors-list cache** — 30-second TTL, `mentors:list:${JSON.stringify(filters)}` key, and `invalidateMentorListCache()` is called (fire-and-forget via `void`) after `approveMentor` (line 196), `rejectMentor` (line 242), and `banMentor` (line 317) in `admin.service.ts`.
- **Socket.IO Redis adapter** — `chat.gateway.ts` gates on `process.env.SOCKET_REDIS_ADAPTER === 'true'`, wraps adapter setup in try/catch with a `logger.warn` fallback. Correct.
- **SEO / OG** — `sitemap.ts` and `robots.ts` present. Per-route `opengraph-image.tsx` files exist for `/`, `/pricing`, `/get-app`, `/(legal)/privacy`. All four pages (`/pricing`, `/get-app`, `/privacy`, `/terms`) plus `/refund-policy` have `metadata` exports with `openGraph` and `twitter` fields. Landing page has valid `@graph` JSON-LD with both `Organization` and `WebSite` types.
- **Hygiene** — No `this.redis` field remains in `auth.service.ts`; no `import { Redis }` either. `Clock` is confirmed absent from `apps/mobile/app/(tabs)/mentees.tsx`. `ForbiddenException` is absent from `apps/api/src/modules/invites/`. `IsString` is absent from `apps/api/src/modules/storage/dto/presign-upload.dto.ts`. `SkeletonRow` in `apps/mobile/app/(tabs)/chat/index.tsx` (line 234) correctly uses `useSharedValue` + `withRepeat(withTiming(...), -1, true)` + `useAnimatedStyle` reading from the shared value. Sentry `--mount=type=secret` in `Dockerfile.web`, `secrets:` block in `docker-compose.prod.yml`, and `secrets:` in `deploy.yml` are all present.
- **Nudges** — `@Cron('0 */6 * * *')` (mirror) and `@Cron('0 */12 * * *')` (mentor). 7-day dedupe via `OnboardingEvent` rows with step `mirror_nudge_sent` / `mentor_nudge_sent`. 500-row cap via `take: CAP`. Push body/title contain no phone, email, handle, or `@`/`+91` patterns. `POST /admin/nudges/trigger` is `@Roles(Role.ADMIN)` and returns `{ count }`. 12 vitest specs cover dedup, cap, anonymity, dispatch, cron gate, and admin trigger paths.
- **M1–M4** — `analytics.service.ts` uses `where: { reviewedAt: null }` (not `submittedAt`). `AnalyticsService implements OnModuleDestroy` with `redis.quit()`. `api-client` `admin.flags.set` returns full `FeatureFlag` shape. `admin.flags.seed` returns `{ seeded, skipped, total }`.
- **TypeScript** — All three apps (`apps/api`, `apps/web`, `apps/mobile`) typecheck with zero errors. 127 API tests pass.
- **No `console.log`** — None found in production code across `apps/api`, `apps/web`, or `apps/mobile`.
- **Anonymity** — Nudge push bodies contain only generic text, no handle/phone/email/Aadhaar. Chat push notification uses `displayHandle` (not real name) as title.
