# Wave 16 Review — 2026-05-13

## Summary

CONDITIONAL PASS. Two issues block a clean green gate: a stale type definition that
creates a structural lie in the shared types package, and non-executable script file
modes that will silently fail in cron. Everything else — anonymity, metrics PII policy,
Caddyfile, build, tests — is clean.

---

## CRITICAL

None.

---

## MAJOR

### MAJOR-1: `OtpRequestResponse` in `packages/types/src/index.ts` still declares `phone: string` (required)

File: `/root/Mento/packages/types/src/index.ts` lines 151-156

```ts
export interface OtpRequestResponse {
  phone: string        // <-- still here, still required
  expiresIn: number
  devCode?: string
}
```

The anonymity fix in `auth.controller.ts` removed the phone echo from the response,
and `otp.service.ts` `issue()` returns `{ expiresIn, devCode? }` — no `phone` field.
The actual wire format therefore never includes `phone`, but the shared type says it is
a required `string`. Any consumer that reads `res.phone` will receive `undefined` at
runtime while TypeScript believes it is a `string`. The api-client in
`packages/api-client/src/index.ts` types `requestOtp` as `Promise<OtpRequestResponse>`,
propagating the bad type to every caller.

Current callers (`apps/web/app/(auth)/login/page.tsx` line 330: `if (res.devCode)`)
only read `devCode`, so there is no crash today. But the type is a structural lie and
will burn the first person who trusts it. The fix is to drop `phone` from the interface
or mark it `phone?: string | null`.

### MAJOR-2: Backup/restore scripts committed without executable bit (mode 100644 not 100755)

Confirmed via `git ls-files --stage scripts/`:

```
100644 ... scripts/backup-pg.sh
100644 ... scripts/restore-pg.sh
```

Both files lack the executable bit. On any host where the repo is freshly cloned and
the cron entry refers to the script path directly, the shell will refuse to execute
them with "Permission denied". The cron entry suggested in the header comment
(`0 2 * * * /srv/mento/scripts/backup-pg.sh`) will silently fail at the OS level.
The runbook must be updated to note `chmod +x` after clone, or the git mode must be
corrected with `git update-index --chmod=+x`.

---

## MINOR

### MINOR-1: Misleading comment in `metrics.interceptor.ts` line 16

File: `/root/Mento/apps/api/src/common/metrics.interceptor.ts`

```
*   route  — parameterised path from Express route (e.g. /auth/otp/:phone).
```

No route in the auth controller uses `:phone` as a URL parameter. All OTP routes use
POST body parameters. The example incorrectly suggests a pattern that would leak phone
numbers into Prometheus label cardinality if it existed. The comment should be changed
to a real example such as `/admin/users/:id` or `/conversations/:id`.

### MINOR-2: `$?` check after command substitution assignment in `restore-pg.sh` lines 187-194

The pattern `USER_COUNT="$(docker exec ...)" ; if [[ $? -ne 0 ]]` works correctly in
bash: the assignment does not trigger `set -e` on subshell failure, and `$?` does
capture the subshell exit code. However this is a common source of confusion and a
bash linter (shellcheck SC2181) would flag it. The idiomatic safe form is to split the
call:

```bash
if ! USER_COUNT="$(docker exec ...)"; then
  echo "WARNING: ..." >&2
fi
```

No runtime defect today, but worth cleaning up to avoid future confusion.

### MINOR-3: Caddy `X-Forwarded-For` / `X-Forwarded-Proto` header_up directives are redundant

`caddy validate` emits two warnings:

```
Unnecessary header_up X-Forwarded-For: the reverse proxy's default behavior is to pass headers to the upstream
Unnecessary header_up X-Forwarded-Proto: the reverse proxy's default behavior is to pass headers to the upstream
```

These are in both the `api.mento.in` and `mento.in` blocks. No security implication,
but they add noise to the Caddyfile and will appear in every `caddy validate` run.

---

## What's clean

**Anonymity fix (138fa5a)**
- `auth.controller.ts` `/otp/request`: returns `result` from `otp.issue()` which is
  `{ expiresIn, devCode? }` — phone is not present. Correct.
- `auth.controller.ts` `/otp/verify`: response object is hand-constructed and explicitly
  omits `phone`, `email`, `googleSub`. Only `id`, `role`, `status`, `createdAt`,
  `updatedAt` are returned. Correct.
- `auth.controller.ts` `/google`: identical safe pattern to `/otp/verify`. Consistent.
- `otp.service.ts` log line 80: `[DEV] OTP issued (devCode returned in response)` — no
  phone, no code. Correct.
- `otp.service.ts` lockout log line 161: `phone [REDACTED]` — correct.
- `packages/types/src/index.ts` `User` interface: `phone` and `email` are now
  `string | null | undefined` (optional), with a comment explaining they are admin-only.
  Auth stores reference the shared `User` type; neither store reads `phone` or `email`.
- No UI in `apps/web/app/(app)/**/*.tsx` reads `user.phone` or `user.email` outside of
  the admin-only `admin/users/[id]/page.tsx`, which correctly fetches from the admin
  endpoint that explicitly includes those fields in its `UserDetail` local type.
- Mobile app: no `user.phone` or `user.email` reads anywhere in `apps/mobile/app/`.

**Prometheus metrics (dbf83a7)**
- All counter label names are enumerated values: `method`, `outcome`, `requiredTier`,
  `to`, `tier`, `action`. No userId, phone, or email appear as label names or values.
- `httpRequestDuration` uses `route` (Express parameterised pattern, not raw URL) +
  `status` (numeric string). No raw UUIDs or PII can appear in label cardinality.
- `MetricsModule` is decorated `@Global()` and exports `MetricsService`. Injection works
  everywhere without per-module imports.
- `MetricsController` is decorated `@Public()`. Caddy 403s the `/metrics` path for
  public internet traffic; Prometheus scrapes via the internal docker network directly
  to `api:4000/metrics` which is not routed through Caddy.
- PII grep returned zero results for `inc(...phone`, `inc(...userId`, `inc(...email`,
  `observe(...phone`, `observe(...userId`, `observe(...email`.

**Backup scripts (07bd035)**
- Both scripts begin with `#!/usr/bin/env bash` and `set -euo pipefail`. Confirmed.
- No `rm -rf` against arbitrary paths; only `rm -f "${FILEPATH}"` against a tightly
  scoped variable pointing to a specific timestamped file in `/srv/mento/backups/`.
- Pruning uses `find ... -name 'mento-*.sql.gz' -mtime ... -delete` with `-maxdepth 1`
  and a fixed name glob. Safe.
- No password as a CLI argument; `PGPASSWORD` is passed via `docker exec -e`.
- Credentials are read from `.env.prod` via `grep`/`cut`, not `source`, to avoid
  arbitrary code execution.
- `restore-pg.sh` refuses to proceed when the API container is healthy unless `--force`
  is explicitly passed.
- `restore-pg.sh` requires `-y`/`--yes` or interactive "YES" confirmation.
- S3 upload is gated on `BACKUP_S3_BUCKET` being non-empty; R2 is supported via
  `AWS_ENDPOINT_URL`.

**Build and tests**
- `cd /root/Mento/apps/api && pnpm typecheck`: PASS (zero errors)
- `cd /root/Mento/apps/web && pnpm typecheck`: PASS (zero errors)
- `cd /root/Mento/apps/mobile && pnpm typecheck`: PASS (zero errors)
- `cd /root/Mento/apps/api && pnpm build`: PASS (NestJS dist compiled cleanly)
- `cd /root/Mento/apps/api && pnpm test`: PASS — 7 test files, 142 tests, all passing.
  Tests do not assert on `phone` in any OTP response; they only check `devCode` and
  `expiresIn`. No test regressions from the anonymity fix.
- `caddy validate -c infra/docker/Caddyfile`: Valid configuration (2 harmless warnings
  on redundant header_up directives — see MINOR-3).
