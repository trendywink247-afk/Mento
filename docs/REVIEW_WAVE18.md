# Wave 18 Review — 2026-05-13

## Summary

FAIL — one CRITICAL blocker found. The two Wave 17 MAJOR findings (script chmod, commit count) are now correctly resolved: both scripts are `100755` in git, and the release notes commit count is accurate at 86. The simulate-success controller guard is correctly implemented. However, the new PgBouncer healthcheck command calls `psql`, which is not installed in `edoburu/pgbouncer:latest`. The healthcheck will loop until it exhausts its retry budget and mark the container unhealthy on every prod deploy, blocking the api container from starting.

---

## CRITICAL

### CRIT-1 — PgBouncer healthcheck calls `psql`, which is absent from `edoburu/pgbouncer:latest`

**File:** `/root/Mento/infra/docker/docker-compose.prod.yml`, lines 114-116

**Command in YAML:**
```
PGPASSWORD=$$DB_PASSWORD psql -h localhost -p 6432 -U $$DB_USER -d $$DB_NAME -c 'SELECT 1' >/dev/null 2>&1
```

**Verified by pulling the image and running:**
```
docker run --rm --entrypoint="" edoburu/pgbouncer:latest sh -c "which psql" → NOT FOUND
```

The `edoburu/pgbouncer:latest` image is Alpine-based and does not ship the `postgresql-client` package. Available tools confirmed in the image: `nc`, `pg_isready`, `wget`. The healthcheck will therefore always return exit code 127 ("command not found"), meaning the pgbouncer service will never reach `healthy`, and the api container (which `depends_on: pgbouncer: condition: service_healthy`) will never start.

**Impact:** Every production deploy deadlocks at the pgbouncer startup stage. The Docker Compose boot order is broken for the entire stack.

**Fix:** Replace `psql` with `pg_isready` (present in the image) for a TCP-level liveness check, or use `nc`:

Option A — `pg_isready` (recommended, semantically correct):
```yaml
test:
  - CMD-SHELL
  - pg_isready -h localhost -p 6432 -U $$DB_USER -d $$DB_NAME
```

Option B — pure TCP check (minimal, always works):
```yaml
test:
  - CMD-SHELL
  - "nc -z localhost 6432"
```

Note: `pg_isready` performs the PostgreSQL startup-packet handshake so it confirms PgBouncer is actually accepting connections, not merely that the port is open — prefer Option A.

---

## MAJOR

None.

---

## MINOR

### MINOR-1 — Release notes ship-killer count is internally inconsistent

`docs/RELEASE_NOTES_v0.1.0.md` line 9 (TL;DR): "11 reviewer-found ship-killers caught + fixed across audits"
`docs/RELEASE_NOTES_v0.1.0.md` line 64 (Acknowledgements): "Reviewer rounds caught 9 critical ship-killers"

The two figures disagree. Counting actual non-"None" CRITICAL items across all `REVIEW_WAVE*.md` files (using `### Cx` or `**C-x**` notation):

- REVIEW_WAVE4: 1 (ESLint disable on unconfigured rule blocking build)
- REVIEW_WAVE67: 1 (NEXT_PUBLIC_API_URL vs NEXT_PUBLIC_API_BASE_URL)
- REVIEW_WAVE9_10: 1 (web production build fails — unescaped entities)
- REVIEW_WAVE11: 2 (AnalyticsModule + FlagsModule not in AppModule)
- REVIEW_WAVE12: 1 (@nestjs/schedule not in package.json)
- REVIEW_WAVE13: 1 (@nestjs/schedule absent from pnpm-lock.yaml)
- REVIEW_WAVE18: 1 (this report — psql absent from pgbouncer image)

Total across all waves (including Wave 18): **8 confirmed**, none of which are 9 or 11. The discrepancy between the two stated figures (9 vs 11) and the actual figure (7 pre-Wave-18) suggests the count was updated in TL;DR but not reconciled in Acknowledgements, and neither figure is accurate. This is cosmetic but will confuse readers of the release history.

### MINOR-2 — `latest` image tag is not pinned to a digest

**File:** `/root/Mento/infra/docker/docker-compose.prod.yml`, line 89

```yaml
image: edoburu/pgbouncer:latest
```

The comment correctly explains why a specific version tag was not used (`edoburu` does not publish `1.23.x` tags). However, `latest` is a floating tag that can silently change between deployments. The image pulled at smoke time was digest `sha256:85d1e385...`. A reproducible deployment should pin to that digest:

```yaml
image: edoburu/pgbouncer@sha256:85d1e38593617af1b5f7f285e97d407e56c29939683cc7cfe4c8f6dc19f1268b
```

Alternatively, use a dated or semver tag if `edoburu` publishes one (current `latest` is 1.25.1 per image metadata). Not a production blocker today but breaks reproducibility guarantees.

---

## What's clean

- **Script chmod (CRIT from Wave 17, now fixed):** `git ls-files --stage scripts/` shows `100755` for both `scripts/backup-pg.sh` and `scripts/restore-pg.sh`. Third attempt succeeded; this was the commit `cf6b1f8`.

- **Release notes commit count (MAJOR from Wave 17, now fixed):** `git rev-list --count HEAD` = 86. `RELEASE_NOTES_v0.1.0.md` line 6 states "86 commits on main, 18 waves." Accurate.

- **simulate-success production guard:** `apps/api/src/modules/subscriptions/subscriptions.controller.ts` lines 56-61. `ForbiddenException` is imported (line 4). The guard `if (process.env.NODE_ENV === 'production') throw new ForbiddenException('simulate-success is dev-only')` is the first statement in the method body. Two-layer protection comment block at lines 50-55 is present and accurate.

- **PgBouncer image tag comment:** Line 88-89 correctly explains the rationale for `latest` (edoburu doesn't publish 1.23.x). The Wave 17 reviewer noted this as needed context and it is present.

- **PgBouncer healthcheck intent:** The decision to use `SELECT 1` against the application DB instead of `SHOW POOLS` against the admin DB is correct in principle — it proves connection forwarding end-to-end. The comment block (lines 109-113) accurately documents why `SHOW POOLS` was rejected (admin_users requirement). The flaw is solely the missing `psql` binary, not the strategy.

- **`$$VAR` double-dollar escaping:** The parsed compose config (`docker compose config`) preserves `$$DB_PASSWORD`, `$$DB_USER`, `$$DB_NAME` correctly. Docker Compose v5 resolves `$$` → `$` at container runtime, so the shell inside the container will correctly expand `$DB_PASSWORD` from the container's own environment variables. The escaping strategy is correct; only the missing binary is the bug.

- **Compose config parses without error:** `docker compose -f /root/Mento/infra/docker/docker-compose.prod.yml --env-file /tmp/test-env config` exits 0.

- **API typecheck:** `cd /root/Mento/apps/api && pnpm typecheck` — PASS, zero errors.

- **Web typecheck:** `cd /root/Mento/apps/web && pnpm typecheck` — PASS, zero errors.

- **Mobile typecheck:** `cd /root/Mento/apps/mobile && pnpm typecheck` — PASS, zero errors.

- **API unit tests:** 142 tests across 7 files — all pass. Test counts match the release notes claim exactly.

- **No `console.log` in production API source:** Zero matches in `apps/api/src/` (excluding spec files). The m-5 issue flagged in Wave 9/10 (`main.ts` line 85) is resolved.

- **Release notes test counts:** 142 unit + 32 API e2e + 118 browser e2e. Wave 17 MINOR-1 noted the correct split; these figures are now reflected accurately in `RELEASE_NOTES_v0.1.0.md` line 7.
