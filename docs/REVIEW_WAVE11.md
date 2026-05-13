# Wave 11 Review — 2026-05-13

## Summary

FAIL. Two critical issues block production functionality: `AnalyticsModule` and `FlagsModule` are missing from `app.module.ts`, meaning all analytics and feature-flag API routes return 404. Additionally, the invite redemption transaction has a race condition that can over-issue a 1-use code. One major bug inflates the `pendingDocs` count in analytics. Build and typechecks pass; all 127 tests pass.

---

## CRITICAL

### C1 — `AnalyticsModule` and `FlagsModule` not registered in `AppModule`

**File:** `/root/Mento/apps/api/src/app.module.ts`

Neither module is imported. Both modules define controllers (`AnalyticsController`, `FlagsPublicController`, `FlagsAdminController`) that are never registered in NestJS DI. Every route in these modules — `GET /admin/analytics/summary`, `GET /flags`, `GET /admin/flags`, `PATCH /admin/flags/:key`, `POST /admin/flags/seed` — returns HTTP 404 in production.

The web analytics page (`/admin/analytics`) and admin flags page (`/admin/flags`) will fail to load any data. The mobile and web `FeatureFlagsProvider` will silently fail on every poll (the catch block swallows the error), leaving all flags at `false` permanently — including `chat-search: true` (which defaults false on load, never corrects itself).

Fix: add `AnalyticsModule` and `FlagsModule` to the `imports` array in `app.module.ts`.

### C2 — Invite redemption race condition: two concurrent signups can both redeem a 1-use code

**File:** `/root/Mento/apps/api/src/modules/invites/invites.service.ts`, lines 98–118

`redeemForUser` uses a Prisma interactive transaction, which runs at PostgreSQL's default isolation level: **READ COMMITTED**. The race:

1. User A and User B simultaneously call `verifyOtp` / `googleSignin` with the same invite code (maxUses=1, uses=0).
2. Both transactions read `uses=0` from `inviteCode`.
3. Both pass `assertUsable` (0 < 1).
4. Both insert a `InviteRedemption` row (different `userId` — no constraint violation).
5. Both execute `UPDATE inviteCode SET uses = uses + 1` — code ends at `uses=2`.

The schema has `@@unique([userId])` on `InviteRedemption` but no unique constraint on `(inviteCodeId)` for single-use codes, and no `SELECT ... FOR UPDATE` or `SERIALIZABLE` isolation on the transaction.

Fix: use `tx.$executeRaw` with `UPDATE "InviteCode" SET uses = uses + 1 WHERE id = $1 AND uses < "maxUses" RETURNING id` and treat 0 rows affected as a `GoneException`, or add a `SERIALIZABLE` isolation level option to `$transaction`.

---

## MAJOR

### M1 — `submittedAt: { not: undefined }` is silently ignored by Prisma

**File:** `/root/Mento/apps/api/src/modules/analytics/analytics.service.ts`, line 192

```ts
where: { reviewedAt: null, submittedAt: { not: undefined } },
```

Prisma drops `undefined` values from `where` clauses at runtime. This resolves to `where: { reviewedAt: null }`, counting all `VerificationDocument` rows with no review, regardless of whether they were submitted. In this schema `submittedAt` has `@default(now())` so it is never NULL in practice — the bug has no runtime effect today. However the intent was `{ not: null }`, and as soon as any code path omits setting `submittedAt` the count will silently inflate.

Fix: change to `submittedAt: { not: null }`.

### M2 — `AnalyticsService` leaks a Redis connection (no `OnModuleDestroy`)

**File:** `/root/Mento/apps/api/src/modules/analytics/analytics.service.ts`

`AnalyticsService` constructs its own `ioredis` client in the constructor but does not implement `OnModuleDestroy` / `onModuleDestroy()`. The connection is never closed during graceful shutdown. `FlagsService` in the same wave correctly implements `OnModuleDestroy` with `this.redis.quit()`.

Fix: implement `OnModuleDestroy` and call `this.redis.quit()`.

### M3 — `admin.flags.set` response type in api-client does not match actual API response

**File:** `/root/Mento/packages/api-client/src/index.ts`, line ~598

The client declares: `.json<{ ok: boolean; key: string; enabled: boolean }>()`.

`FlagsService.setFlag` returns the full Prisma `FeatureFlag` object: `{ id, key, enabled, description, updatedBy, updatedAt, createdAt }`. There is no `ok` field. The admin flags page does not consume the return value, so no runtime crash, but any future caller typing against `{ ok }` will receive `undefined`.

### M4 — `admin.flags.seed` response type has wrong keys

**File:** `/root/Mento/packages/api-client/src/index.ts`, line ~604

Client declares: `.json<{ seeded: number; skipped: number; created?: number; existed?: number }>()`.

`FlagsService.seedDefaults` returns `{ seeded, skipped, total }`. The `total` key is missing from the client type; the client advertises `created` and `existed` which are never sent. The admin flags page uses `result.seeded` and `result.skipped` which are present, so no runtime crash today, but the type contract is wrong.

---

## MINOR

### m1 — `RedeemInviteDto` regex allows characters excluded from the invite alphabet

**File:** `/root/Mento/apps/api/src/modules/invites/dto/redeem-invite.dto.ts`

The regex `/^[A-Z0-9]{8}$/` accepts `0`, `1`, `I`, `O` — all deliberately excluded from the generation alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. A code containing those characters will always return 404, not 410. This only affects UX error messages (user gets "not found" instead of "invalid format") and is not a security issue.

Fix: tighten to `/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/`.

### m2 — Hardcoded hex colors in analytics page instead of CSS variables

**File:** `/root/Mento/apps/web/app/(app)/admin/analytics/page.tsx`

The SVG charts and bar charts pass raw hex values (`#3b82f6`, `#8b5cf6`, `#10b981`, `#f59e0b`, `#ef4444`, `#991b1b`, `#94a3b8`) via inline `color` props. The project uses Tailwind/CSS variable tokens from `globals.css` for all other surfaces. If the theme ever changes these chart colors will be orphaned.

### m3 — `AnalyticsService` creates its own `Redis` instance instead of using a shared provider

Both `AnalyticsService` and `FlagsService` (and `AuthService`, `MentorsService`) each instantiate their own `ioredis.Redis` client. The project has no shared Redis provider module, so each service holds a separate connection. Not a bug but increases connection count; a `RedisModule` (similar to `PrismaModule`) would be cleaner.

### m4 — `isNewUser` variable suppressed with `void` lint comment

**File:** `/root/Mento/apps/api/src/modules/auth/auth.service.ts`, line 109

```ts
void isNewUser // used for invite logic above; suppress lint
```

`isNewUser` is computed but not used in any meaningful way after the `if (!user)` block. The suppression comment is misleading. This is pre-existing but was touched in this wave.

---

## What's clean

- **Anonymity**: analytics returns only aggregate counts; no `phone`, `email`, or `googleSub` in any analytics or invite response. `listCodes` explicitly omits `createdBy`.
- **Redis cache TTLs**: 60s for analytics (`admin:analytics:summary`), 30s for flags (`feature_flags:all`) — correct per spec.
- **Cache busting on PATCH**: `FlagsService.setFlag` calls `this.redis.del(CACHE_KEY)` immediately after upsert.
- **`seedDefaults` idempotency**: checks existing keys before insert; `skipDuplicates: true` as belt-and-suspenders.
- **Default flag values**: `chat-search: true`, all others `false` — matches spec.
- **Web provider polls every 60 000 ms** — correct.
- **Mobile provider persists to SecureStore** and restores on startup before fetching fresh flags.
- **`useFeatureFlag` defaults to `false`** when flag absent or not yet loaded (`?? false`).
- **`GET /flags` is `@Public()`** — unauthenticated clients can fetch flags.
- **Invite code generation**: `crypto.randomBytes(8)` with non-confusing base32 alphabet (no `0/O/1/I`) — correct.
- **`BETA_INVITE_REQUIRED` only gates new users**: existing users (found by phone/googleSub) skip `assertInviteCodeProvided`.
- **Ghost-user rollback**: `redeemOrRollback` deletes the user if redemption throws; best-effort `.catch(() => {})` on the delete is acceptable.
- **`POST /invites/redeem` validates only** (calls `validateCode`, not `redeemForUser`) — matches spec.
- **MRR math**: `BASIC×399 + PRO×599 + MAX×999` — correct.
- **Divide-by-zero**: `safeRate(n, 0)` returns 0 — safe.
- **SVG charts are inline React JSX** — no client-only chart library; renders server-side compatible.
- **All typechecks pass** (`api`, `web`, `mobile`).
- **127 API unit tests pass**.
- **Production build passes** (warnings are pre-existing Sentry/OpenTelemetry noise, not Wave 11 regressions).
- **API client namespacing**: `admin.analytics`, `admin.flags`, `admin.invites`, and top-level `flags.list()` — no duplicate namespaces.
