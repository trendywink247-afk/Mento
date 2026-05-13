# Wave 17 Review — 2026-05-13

## Summary

CONDITIONAL PASS with two MAJOR findings. All four commits (`f52d421`, `d28ba67`, `7c093fc`, `8d1c6cc`) land correctly in their primary intent, but two issues require attention before the v0.1.0 tag is trusted: the backup/restore scripts ship at 100644 (not executable) in git, and the release notes overstate the commit count by 38.

---

## CRITICAL

None.

---

## MAJOR

### MAJOR-1 — Scripts are not executable in git (`f52d421`)

`git ls-files --stage scripts/` shows:

```
100644  ...  scripts/backup-pg.sh
100644  ...  scripts/restore-pg.sh
```

Both files are `100644` (not executable). The commit message says "script chmod" was one of the Wave 16 fixes, but the file mode was not actually changed in the index. On a fresh clone, `chmod +x` will be required before either script can run directly. Cron entries in `docs/RUNBOOK.md` that invoke the script paths directly will fail with "Permission denied" on any machine that respects git-tracked permissions.

Fix: `git update-index --chmod=+x scripts/backup-pg.sh scripts/restore-pg.sh` and re-commit.

### MAJOR-2 — Release notes commit count is materially wrong (`8d1c6cc`)

`docs/RELEASE_NOTES_v0.1.0.md` line 6 states "122 commits, 16 waves". The actual commit count in the repository is **84** (`git rev-list --count HEAD`). The overstatement is 38 commits (~45%). This is the first line of the TL;DR section and is factually incorrect at the time of the release tag. The wave count (16) is consistent with `docs/REVIEW_WAVE*.md` files present.

---

## MINOR

### MINOR-1 — Release notes e2e test counts drift from actual spec counts

Line 7: "40 API e2e + 66 browser e2e". Actual counts from `test()` call scanning:

- API e2e (`apps/web/e2e/api/*.spec.ts`): **32** tests
- Browser e2e (`apps/web/e2e/*.spec.ts`): **118** tests

Total e2e count (150) is close to the stated 106, but the split is wrong. The unit test count (142) matches the `pnpm test` output exactly — that claim is correct.

### MINOR-2 — `admin.listUsers` returns phone/email to admin list view

`apps/api/src/modules/admin/admin.service.ts:28-29` returns `phone` and `email` in `listUsers()`. This is the list endpoint (`GET /admin/users`) — not just the detail view — so phone/email are visible in the admin user table. This is gated behind `@Roles(Role.ADMIN)` so it is not an anonymity leak to non-admins, but it wasn't called out in the `d28ba67` commit description which focused on `/me` and OTP paths. Noting for clarity: the admin list returning PII is intentional per spec ("admin-only access to phone/email"), but it's a wider surface than the detail endpoint alone.

### MINOR-3 — `$$VAR` escaping correct but `DB_NAME` defaults may diverge

In `infra/docker/docker-compose.prod.yml` line 114, the healthcheck command uses `$$DB_NAME` which resolves at container runtime to the `DB_NAME` environment variable set in the pgbouncer service block (line 95: `DB_NAME: ${POSTGRES_DB:-mento}`). The escaping is correct — `docker compose config` exits 0. However: if an operator sets `POSTGRES_DB` to something other than `mento` via `.env.prod`, `DB_NAME` picks it up correctly. No bug — just confirming it is wired.

### MINOR-4 — k6 crash-output blob SHA in release notes does not match claim

`docs/RELEASE_NOTES_v0.1.0.md:60` warns about a "2.5 GB k6 crash-output blob in git history at `9f645a1`". The commit at `9f645a1` is actually "fix: lockfile now includes @nestjs/schedule — Docker build unblocked", which is a lockfile fix, not a k6 output import. The 2.5 GB blob concern may be valid but the attributed SHA appears to be wrong, which will confuse any operator who tries to run `git filter-repo` targeting that commit.

---

## What's clean

- **Version bump consistency** (`8d1c6cc`): all 9 `package.json` files are at `0.1.0`. `apps/mobile/app.json` has `expo.version = "0.1.0"`, `ios.buildNumber = "1"`, `android.versionCode = 1`. No drift.
- **Anonymity invariant** (`d28ba67`): `packages/types/src/index.ts` marks `phone`, `email`, `googleSub` as `optional`. `apps/api/src/modules/users/users.service.ts getMe()` returns only `id, role, status, createdAt, updatedAt`. Auth controller both paths (`verifyOtp`, `googleSignin`) return the same stripped shape. `SECURITY.md` has a clear "User shape / anonymity invariant" section. No `user.phone` / `user.email` / `user.googleSub` references exist in web or mobile source outside the admin-only detail page (`apps/web/app/(app)/admin/users/[id]/page.tsx`), which uses a local `UserDetail` type that explicitly includes them — correct and intentional.
- **Admin detail route** (`GET /admin/users/:id`): lives in `moderation.controller.ts` under `@Roles(Role.ADMIN)`. Returns `phone` and `email`. This is intentional and correctly gated.
- **OtpRequestResponse type** (`f52d421`): `packages/types/src/index.ts:151-155` — `OtpRequestResponse` has `expiresIn: number` and `devCode?: string`. No `phone` field. No caller in web/mobile/api-client accesses `.phone` on this type. Login pages correctly access only `res.devCode`.
- **Script content** (`f52d421`): both `scripts/backup-pg.sh` and `scripts/restore-pg.sh` begin with `set -euo pipefail`. `scripts/README.md` is correctly `100644`.
- **PgBouncer healthcheck** (`7c093fc`): `$$VAR` double-dollar escaping is correct for docker-compose. `DB_USER`, `DB_PASSWORD`, `DB_NAME` are all set in the pgbouncer service `environment` block (lines 93-95). `docker compose config` exits 0 with warnings only for unset secret vars (expected without `.env.prod`). The `SHOW POOLS;` query is a real protocol-level check, superior to `nc -z`.
- **TypeScript builds**: all three apps (`api`, `web`, `mobile`) pass `pnpm typecheck` with zero errors.
- **API unit tests**: 142 tests, 7 test files, all pass.
- **Next.js production build**: completes successfully.
- **CHANGELOG.md**: v0.1.0 entry is at the top with the correct date (2026-05-13).
- **JournalCategory count**: 17 values in the union type, matching the release notes claim.
- **`console.log` audit**: zero `console.log` statements found in production source files (api src, web app/components/lib, mobile app/components/lib).
