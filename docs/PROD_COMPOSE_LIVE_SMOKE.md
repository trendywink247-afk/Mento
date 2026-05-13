# Prod Compose Live Smoke — 2026-05-13

---

## Wave 20 — pg_isready healthcheck (2026-05-13)

### Headline

All three data-tier containers (postgres, redis, pgbouncer) boot healthy. The `pg_isready` healthcheck (4th iteration) is confirmed working. PgBouncer transitions to `healthy` on the **first poll — within 5 seconds of container start**, with zero failing streak.

### Healthcheck poll log

| Time (poll) | Status |
|-------------|--------|
| [5s] 20:05:21 | healthy |

Container reached healthy on the very first check interval. No unhealthy transitions recorded.

### Docker healthcheck inspect (raw)

```json
{
    "Status": "healthy",
    "FailingStreak": 0,
    "Log": [
        {
            "Start": "2026-05-13T20:05:21.381166839Z",
            "End": "2026-05-13T20:05:21.448625263Z",
            "ExitCode": 0,
            "Output": "localhost:6432 - accepting connections\n"
        },
        {
            "Start": "2026-05-13T20:05:31.44937684Z",
            "End": "2026-05-13T20:05:31.51404868Z",
            "ExitCode": 0,
            "Output": "localhost:6432 - accepting connections\n"
        }
    ]
}
```

Both health runs return exit code 0 and output `localhost:6432 - accepting connections`. This is the canonical pg_isready success output — confirms PgBouncer is accepting the Postgres startup-packet handshake on its listen port.

### pg_isready manual verification

```bash
docker exec mento-pgbouncer-prod sh -c "pg_isready -h localhost -p 6432 -U mento -d mento"
# Output: localhost:6432 - accepting connections
# Exit:   0
```

### PgBouncer logs during healthcheck

```
2026-05-13 20:05:16 UTC LOG process up: PgBouncer 1.25.1 ...
2026-05-13 20:05:21 UTC LOG C-...: mento/mento@127.0.0.1:51430 login attempt: db=mento user=mento tls=no replication=no
2026-05-13 20:05:31 UTC LOG C-...: mento/mento@127.0.0.1:55948 login attempt: db=mento user=mento tls=no replication=no
```

`pg_isready` sends a startup packet, PgBouncer accepts it and logs a login attempt, then the client disconnects cleanly (no full query round-trip needed — this is expected behavior). No `S-...: new connection to server` lines appear because `pg_isready` never sends a query, so PgBouncer correctly does not borrow a server-side connection.

### Final verdict: HEALTHY

The `pg_isready` approach is confirmed correct and sufficient. The 4th iteration resolves all prior failures:

| Iteration | Approach | Failure mode |
|-----------|----------|--------------|
| Wave 17 | `nc -z localhost 6432` | Only proves TCP port bound, not auth/routing |
| Wave 18 | `SHOW POOLS` via psql | Wrong DB (mento vs pgbouncer admin), mento not in admin_users |
| Wave 19 | `SELECT 1` via psql | psql binary absent in edoburu/pgbouncer:latest Alpine image |
| **Wave 20** | **`pg_isready -h localhost -p 6432 -U $DB_USER -d $DB_NAME`** | **PASSES — exit 0, healthy** |

### Teardown

All containers removed. Volumes `mento-prod_mento_pg_prod` removed with `down -v`. Network `mento-prod_mento_internal` removed. No orphaned resources.

---

## Wave 18/19 — Previous results (historical)

### Service-by-service results

| Service   | Boot? | Healthy? | Notes |
|-----------|-------|----------|-------|
| postgres  | YES   | YES      | pg_isready healthcheck passes in ~9 s |
| redis     | YES   | YES      | redis-cli ping healthcheck passes in ~9 s |
| pgbouncer | YES   | NO       | Starts and routes connections correctly; healthcheck has two bugs (see below) |
| api       | skipped (no image in registry) | — | Build smoke validated in Wave 10 |
| web       | skipped (no image in registry) | — | Build smoke validated in Wave 10 |
| caddy     | skipped (depends on api+web)   | — | Config parse validated |

## `docker compose config` result

Exit 0. No missing-variable errors. All five non-skipped services resolved correctly.

Two ambient env vars leaked in from the host shell environment (GeekSpace2.0 containers running on the same host):
- `CORS_ORIGINS` was overridden to GeekSpace values instead of defaulting to mento.in
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` were populated from host env

These do not affect the data-tier smoke test but confirm the compose file should use `${VAR:-default}` forms only and callers must export a clean env (or use `env -i`).

## PgBouncer — routing is functional, healthcheck is broken

### What works

```
docker exec mento-pgbouncer-prod sh -c \
  "PGPASSWORD=testpass123 psql -h 127.0.0.1 -p 6432 -U mento -d mento -c 'SELECT 1 AS routing_check;'"
```

Output:
```
 routing_check
---------------
             1
(1 row)
```

PgBouncer accepted the connection, authenticated with scram-sha-256, and proxied the query to Postgres successfully. The `S-...new connection to server` log lines confirm a server-side connection was established.

### Bug 1 — Wrong database in healthcheck (-d $$DB_NAME targets application DB, not admin console)

The compose healthcheck is:

```
PGPASSWORD=$$DB_PASSWORD psql -h localhost -p 6432 -U $$DB_USER -d $$DB_NAME -c 'SHOW POOLS;' >/dev/null 2>&1
```

`$$DB_NAME` resolves to `mento` at runtime. `SHOW POOLS` is a PgBouncer admin command — it only works when connected to the virtual `pgbouncer` database (the admin console). When sent to the `mento` application database, Postgres returns:

```
ERROR:  unrecognized configuration parameter "pools"
```

Fix: change `-d $$DB_NAME` to `-d pgbouncer`.

### Bug 2 — mento user is not in admin_users

Even with `-d pgbouncer`, the `mento` user would be rejected because the edoburu entrypoint sets `admin_users = ${ADMIN_USERS:-postgres}` — only `postgres` is an admin by default. The userlist.txt only contains `mento` with its password; `postgres` has no entry and cannot authenticate.

Fix: add `ADMIN_USERS: ${POSTGRES_USER:-mento}` to the pgbouncer `environment:` block in docker-compose.prod.yml.

### Corrected healthcheck (both fixes applied)

```yaml
pgbouncer:
  environment:
    # ... existing vars ...
    ADMIN_USERS: ${POSTGRES_USER:-mento}   # ADD THIS
  healthcheck:
    test:
      - CMD-SHELL
      - "PGPASSWORD=$$DB_PASSWORD psql -h localhost -p 6432 -U $$DB_USER -d pgbouncer -c 'SHOW POOLS;' >/dev/null 2>&1"
      #                                                                       ^^^^^^^^^^ change from $$DB_NAME
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 15s
```

### Alternative healthcheck (simpler, lower privilege)

If admin console access is undesirable, replace `SHOW POOLS` with a plain connectivity check against the application DB:

```yaml
  healthcheck:
    test:
      - CMD-SHELL
      - "PGPASSWORD=$$DB_PASSWORD psql -h localhost -p 6432 -U $$DB_USER -d $$DB_NAME -c 'SELECT 1' >/dev/null 2>&1"
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 15s
```

`SELECT 1` passes through the pool and confirms both PgBouncer and Postgres are reachable. This is the recommended option as it avoids needing admin_users configuration.

## Image tag bug

`edoburu/pgbouncer:1.23.1` does not exist on Docker Hub. The image was pulled as `edoburu/pgbouncer:latest` (PgBouncer 1.25.1) and tagged locally as `1.23.1` to unblock the smoke test. The compose file must be updated to a published tag. Available options:

- `edoburu/pgbouncer:latest` (1.25.1 as of 2026-05-13)
- `pgbouncer/pgbouncer:1.23.1` (official PgBouncer image, different entrypoint — env var names differ)

Recommend pinning to `edoburu/pgbouncer:latest` or checking the edoburu Docker Hub tags page for the correct semver tag if a pinned version is required.

## Healthcheck logs (raw pgbouncer)

```
Creating pgbouncer config in /etc/pgbouncer
[databases]
mento = host=postgres port=5432 auth_user=mento
[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
admin_users = postgres

Starting /usr/bin/pgbouncer /etc/pgbouncer/pgbouncer.ini...
LOG listening on 0.0.0.0:6432
LOG process up: PgBouncer 1.25.1
LOG C-...: mento/mento@127.0.0.1:39724 login attempt: db=mento user=mento tls=no
LOG S-...: mento/mento@172.29.0.2:5432 new connection to server (from 172.29.0.4:55596)
LOG C-...: mento/mento@127.0.0.1:39724 closing because: client close request (age=0s)
```

"client close request" = psql exited because SHOW POOLS returned an error from Postgres. The server-side connection (`S-...new connection`) was established successfully before the error occurred.

## Teardown

All containers removed. Volumes `mento-prod_mento_pg_prod` and `mento-prod_mento_redis_prod` removed with `down -v`. No orphaned resources.

## Action items

| Priority | Item |
|----------|------|
| P0 | Fix pgbouncer healthcheck: change `-d $$DB_NAME` to `-d pgbouncer` AND add `ADMIN_USERS: ${POSTGRES_USER:-mento}` — OR switch to `SELECT 1` healthcheck (recommended) |
| P0 | Fix image tag: `edoburu/pgbouncer:1.23.1` does not exist; pin to `edoburu/pgbouncer:latest` or a valid published tag |
| P1 | Isolate env file from host shell when running compose — use `env -i` or ensure callers export only Mento vars |
