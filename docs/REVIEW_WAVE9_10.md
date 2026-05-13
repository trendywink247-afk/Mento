# Wave 9/10 Review — 2026-05-13

## Summary

FAIL — The web production build is broken (ESLint `react/no-unescaped-entities` error in `app/(app)/admin/flags/page.tsx` line 115). All three typechecks pass under default settings, but three TS6133 unused-import/variable violations exist that will be fatal if the Docker build ever enables `--noUnusedLocals`. All other checklist items pass.

---

## Build / typecheck / unit-test results

| Check | Result |
|---|---|
| `apps/api` typecheck (`tsc --noEmit`) | PASS |
| `apps/web` typecheck (`tsc --noEmit`) | PASS |
| `apps/mobile` typecheck (`tsc --noEmit`) | PASS |
| `apps/api` unit tests (`pnpm test`) | PASS — 5 files, 115 tests |
| `apps/web` production build (`pnpm build`) | **FAIL** |

### Web build failure — exact error

```
./app/(app)/admin/flags/page.tsx
115:19  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
115:33  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
```

The string `Click "Seed defaults" to create the built-in flag set.` contains raw double-quote characters inside JSX text. Next.js's ESLint lint pass treats this as a hard error and aborts the build.

---

## CRITICAL

**C-1 — Web production build fails.**
File: `/root/Mento/apps/web/app/(app)/admin/flags/page.tsx`, line 115.
The string `Click "Seed defaults"...` must use `&quot;` or backtick-delimited string moved outside JSX.
This blocks `docker build` for the web image and any CD pipeline that runs `pnpm build`.

---

## MAJOR

**M-1 — Unused imports / variable will be fatal under `--noUnusedLocals` (TS6133).**
The CLAUDE.md states "Unused imports are fatal in Docker builds (TS6133)."
None of the three tsconfigs currently enable `noUnusedLocals`, so these do not block the build today, but they are latent defects:

- `/root/Mento/apps/mobile/app/(tabs)/chat/index.tsx` line 3: `ActivityIndicator` imported but never used.
- `/root/Mento/apps/mobile/app/(tabs)/chat/index.tsx` line 20: `withTiming` imported but never used.
- `/root/Mento/apps/mobile/app/(tabs)/chat/index.tsx` line 235: `const opacity = useSharedValue(0.4)` — declared but never read (the `animStyle` closure reads a computed value directly, not the `opacity` ref).
- `/root/Mento/apps/mobile/components/onboarding/FlashSequence.tsx` line 2: `Text` imported but never used.
- `/root/Mento/apps/api/src/modules/auth/auth.service.ts` line 27: `private readonly redis` — assigned in constructor but `this.redis` is never read anywhere else in the file (the field is dead code; Redis integration was apparently planned but not wired up).
- `/root/Mento/apps/api/src/modules/invites/invites.service.ts` line 5: `ForbiddenException` imported but never thrown.
- `/root/Mento/apps/api/src/modules/storage/dto/presign-upload.dto.ts` line 1: `IsString` imported but no property uses `@IsString()`.
- `/root/Mento/apps/web/app/(app)/mentees/page.tsx` line 6: `Clock` imported but never used.

**M-2 — `this.redis` is dead code in `auth.service.ts`.**
`Redis` is imported, a private field is declared, and the instance is constructed in the constructor, but it is never read again in the 336-line file. If auth actually needs Redis (e.g., for token blocklisting), this is a functional gap. If it does not, the instantiation wastes a connection pool slot on every API pod startup.

---

## MINOR

**m-1 — Hardcoded hex colors in mobile `chat/index.tsx` bypass the design token system.**
`PillTabBar` uses `'#2563eb'`, `'#64748b'`, `'#dbeafe'`, `'#f1f5f9'`, `'#bfdbfe'`, `'#e2e8f0'`; `ArchiveAction` uses `'#f59e0b'`. A broadcast button at line 602 also uses `'#2563eb'`. These should map to the CSS-variable-backed tokens (or the mobile NativeWind equivalents) for dark-mode correctness.

**m-2 — Hardcoded Tailwind color literals in web code bypassing CSS variables.**
- `/root/Mento/apps/web/app/error.tsx` lines 27, 32: `text-gray-500`, `bg-blue-600`, `hover:bg-blue-700` — should use `text-muted-foreground`, `bg-primary`, `hover:bg-primary/90`.
- `/root/Mento/apps/web/app/(app)/layout.tsx` line 201: `bg-emerald-500` (online presence dot) has no semantic token equivalent, which is acceptable, but worth noting.

**m-3 — `app/error.tsx` Sentry import triggers `Critical dependency` webpack warning.**
The build warning chain `./app/error.tsx → @sentry/nextjs → @opentelemetry/instrumentation` emits two `Critical dependency` warnings on every build. These are non-fatal warnings from third-party code, but they are noisy and would be worth an `experimental.serverComponentsExternalPackages` or `transpilePackages` exclusion for Sentry's Node integrations.

**m-4 — Legal layout does not whitelist `/privacy`, `/terms`, `/refund-policy` in the mobile-UA redirect allowlist.**
`apps/web/middleware.ts` only allows `['/get-app', '/.well-known', '/_next', '/favicon.ico', '/api']`. Mobile browsers visiting a shared legal link get silently redirected to `/get-app` instead of seeing the page. This may be intentional (desktop-only site) but contradicts the purpose of public legal pages.

**m-5 — `console.log` present in production API code.**
`/root/Mento/apps/api/src/main.ts` line 85: `console.log('[api] listening on http://localhost:${port}')` — should use the NestJS `Logger` instance that is already configured with pino.

---

## What's clean

- `.npmrc` spelling: `inject-workspace-packages=true` and `auto-install-peers=true` are correct.
- `infra/docker/Dockerfile.api` deps stage (line 17): `.npmrc` is now explicitly `COPY`-ed alongside `package.json pnpm-lock.yaml pnpm-workspace.yaml`. The Wave 9 fix (`36ad73c`) is present and correct.
- `.dockerignore` does NOT exclude `apps/api/prisma/schema.prisma` or `apps/api/prisma/migrations/`. The `docs` exclusion only excludes the top-level `docs/` directory. Prisma paths are safe.
- `.dockerignore` correctly allows `.env.example` and `.env.prod.example` via the `!` exemptions while excluding all other `.env.*` variants.
- `apps/mobile/app/(tabs)/chat/index.tsx` `load` callback: correctly typed as `async (): Promise<void>` (line 470). All four `onRefresh` handlers `await load()` inside `try/finally`.
- Catch-up migration `20260513000000_catch_up_phases_a_through_g/migration.sql` contains `'DISMISS'`, `'SUSPEND_ASPIRANT'`, `'SUSPEND_MENTOR'` enum values (lines 114-116). The prod migration path is safe.
- `docker-compose.prod.yml` api block includes `RAZORPAY_PLAN_BASIC`, `RAZORPAY_PLAN_PRO`, `RAZORPAY_PLAN_MAX`, `EXPO_ACCESS_TOKEN`, and `SOCKET_REDIS_ADAPTER`.
- `NEXT_PUBLIC_API_URL` is fully absent from all non-doc source files. Only `NEXT_PUBLIC_API_BASE_URL` is used (confirmed in `apps/web/lib/api.ts` line 3).
- `@tailwindcss/typography` is installed in `apps/web/package.json` and registered in `tailwind.config.ts` plugins.
- Legal layout (`app/(legal)/layout.tsx`) has no auth gate — purely a layout wrapper.
- `moderation-flow.spec.ts` MOD-UI-3 assertion now checks `.not.toContain('Application error')` and `.not.toContain('_next/static/chunks/fallback/')` — the fragile bare `'500'` assertion is gone.
- All 115 unit tests pass (5 test files, 24 moderation tests including DISMISS/SUSPEND/BAN paths).
- API and web typechecks pass cleanly under default tsconfig settings.
