# Prod Compose Live Smoke — 2026-05-13

## Headline

postgres and redis boot healthy; pgbouncer starts and routes connections correctly but its SHOW POOLS healthcheck is misconfigured and reports unhealthy — two bugs identified with fixes documented below.

## Service-by-service results

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
