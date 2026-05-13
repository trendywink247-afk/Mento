# Production Compose Smoke Report

Date: 2026-05-13
Validator: infra agent (claude-sonnet-4-6)

## Summary

| Check | Result |
|-------|--------|
| docker compose config parse | PASS (exit 0) |
| Required env vars resolved | PASS (no missing-var warnings) |
| Service topology | PASS |
| Healthchecks | PASS |
| Caddyfile caddy validate | PASS (exit 0, warnings only) |
| Dockerfile.api buildx --check | PASS (exit 0, no warnings) |
| Dockerfile.web buildx --check | WARN (2 warnings, exit 1) |
| Dockerfile.api docker build smoke | FAIL (pnpm deploy breakage) |

---

## Check 1: docker compose config

Command:
```bash
docker compose -f /root/Mento/infra/docker/docker-compose.prod.yml \
  --env-file /tmp/mento-test.env config
```

Exit code: 0. No warnings about missing or unset required variables.

### Service topology (resolved)

| Service | Image | Healthcheck | Depends on (condition) |
|---------|-------|-------------|------------------------|
| postgres | postgres:16-alpine | pg_isready (10s/5s/5r/20s start) | — |
| redis | redis:7-alpine | redis-cli ping (10s/5s/5r/10s start) | — |
| api | ghcr.io/${GHCR_OWNER}/mento-api:${IMAGE_TAG} | wget /healthz (15s/5s/5r/30s start) | postgres:healthy, redis:healthy |
| web | ghcr.io/${GHCR_OWNER}/mento-web:${IMAGE_TAG} | wget / (15s/5s/5r/40s start) | api:healthy |
| caddy | caddy:2-alpine | none | api:healthy, web:healthy |

Boot order enforced: postgres + redis → api → web → caddy. Correct.

### Network

Single bridge network `mento_internal`. Postgres and Redis are NOT exposed on the host (no `ports:` mappings). Only Caddy exposes 80/443/443-udp on the host. Correct.

### Volumes

Four named volumes: `mento_pg_prod`, `mento_redis_prod`, `mento_caddy_data`, `mento_caddy_config`. All driver: local. Correct.

### Host env leakage observed (WARNING)

During config expansion the shell environment on the VPS leaked several values into the rendered YAML that were NOT in the stub env file:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — resolved from the host shell env (GeekSpace2.0 environment). These are real credentials.
- `CORS_ORIGINS` — resolved to GeekSpace2.0 domains instead of the Mento default.
- `REDIS_URL` — resolved from host env without password prefix.

Root cause: Docker Compose merges the `--env-file` with the process environment. Any variable already set in the shell environment takes precedence over (or supplements) the env-file. Since this VPS runs GeekSpace2.0 in the same shell context, overlapping variable names bleed through.

Action required: Before deploying, ensure you invoke compose from a clean environment or explicitly unset conflicting variables:
```bash
env -i HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod up -d
```
Or add `GOOGLE_CLIENT_ID=`, `GOOGLE_CLIENT_SECRET=`, `CORS_ORIGINS=` to `.env.prod` to pin them explicitly.

---

## Check 2: Caddyfile validation

Command: `caddy validate --config /root/Mento/infra/docker/Caddyfile`
Result: "Valid configuration" (exit 0)

### Caddy warnings (non-fatal)

1. `Unnecessary header_up X-Forwarded-For` — Caddy's reverse proxy already passes this by default. The explicit directive is redundant but harmless. Appears twice (api and web blocks).
2. `Unnecessary header_up X-Forwarded-Proto` — same reason. Appears twice.
3. `Caddyfile input is not formatted` — run `caddy fmt --overwrite infra/docker/Caddyfile` to silence this. Purely cosmetic.

### Security header verification

| Header | api.mento.in | mento.in |
|--------|-------------|---------|
| HSTS (max-age=31536000 includeSubDomains preload) | YES | YES |
| X-Frame-Options: DENY | YES | YES |
| X-Content-Type-Options: nosniff | YES | YES |
| Referrer-Policy | YES | YES |
| Permissions-Policy | YES | YES |
| Server header removed (-Server) | YES | YES |

### Encoding

`encode zstd gzip` present in both site blocks. Correct.

### HTTP→HTTPS redirect

Caddy validate output confirms: "enabling automatic HTTP->HTTPS redirects". The `www.mento.in` block has an explicit `redir https://mento.in{uri} permanent`. Both paths handled.

### Upstream addresses

- `api.mento.in` → `api:4000` (matches compose service name + port)
- `mento.in` → `web:3000` (matches compose service name + port)

### Caddyfile gaps (informational)

- No SPA fallback (`try_files` / `handle_errors`) on the web block. Next.js standalone handles its own routing, so this is fine — the Next.js server returns 404 pages itself.
- No explicit rate-limiting directives. Consider `rate_limit` for the `/auth/*` paths pre-production.

---

## Check 3: Dockerfile lint (buildx --check)

### Dockerfile.api

Command: `docker buildx build --check -f infra/docker/Dockerfile.api /root/Mento`
Result: "Check complete, no warnings found." (exit 0)

Structural audit:
- Multi-stage: deps → builder → runtime. Correct.
- Non-root user: `USER appuser` (uid 1001). Correct.
- HEALTHCHECK directive present. Correct.
- tini as ENTRYPOINT for proper PID 1 signal handling. Correct.
- Prisma schema + prisma client engines copied via `COPY --from=builder ./prisma`. Correct.
- No secrets hardcoded. Correct.
- No `.dockerignore` at repo root — entire build context is sent. This is a performance issue (sends `node_modules`, `.git`, etc.) but not a correctness failure. See recommendation below.

### Dockerfile.web

Command: `docker buildx build --check -f infra/docker/Dockerfile.web /root/Mento`
Result: exit 1, 2 warnings.

WARNING 1 — `SecretsUsedInArgOrEnv` at line 53:
```
ARG SENTRY_AUTH_TOKEN
```
WARNING 2 — `SecretsUsedInArgOrEnv` at line 60:
```
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
```

Assessment: `SENTRY_AUTH_TOKEN` is a build-time token used only by Sentry's webpack plugin to upload source maps. It does not end up in the final image layer (only the builder stage uses it) and is not baked into the runtime image. The warning is a false positive for this specific usage pattern. However, buildx --check fails with exit 1, which would break any CI step that checks the Dockerfile for errors.

Mitigation options (in order of preference):
1. Pass the token via `--secret` (BuildKit secrets) and read it with `RUN --mount=type=secret,id=sentry_token ...`. This eliminates the warning and is the correct approach.
2. Add `# hadolint ignore=DL3025` if using hadolint, or accept the warning in CI with `|| true`.

Structural audit (web):
- Multi-stage: deps → builder → runtime. Correct.
- Non-root user: `USER appuser` (uid 1001). Correct.
- HEALTHCHECK directive present. Correct.
- tini as ENTRYPOINT. Correct.
- Standalone output copied: `.next/standalone`, `.next/static`, `public`. Correct.
- `BUILD_STANDALONE=1` env var set to activate standalone mode in `next.config.mjs`. Correct.
- CMD points to `apps/web/server.js` (correct path inside standalone bundle for a workspace build).

---

## Check 4: docker build smoke (Dockerfile.api)

Command: `docker build -f /root/Mento/infra/docker/Dockerfile.api -t mento-api:smoke /root/Mento`

Result: BUILD FAILED at stage `builder`, step `pnpm --filter @mento/api --prod deploy /prod/api`

Error:
```
ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE
We only support deploy from workspaces that use the inject-workspace-packages=true setting
```

Root cause: `pnpm@10` (declared as `packageManager: pnpm@10.0.0` in root `package.json`) changed the behavior of `pnpm deploy`. In pnpm 10, deploying a workspace package requires either:
- `inject-workspace-packages=true` in `.npmrc`, OR
- a different pruning strategy

There is currently no `.npmrc` at the repo root or in `apps/api/`.

Fix: Add `inject-workspace-packages=true` to a root `.npmrc`:
```
# .npmrc (repo root)
inject-workspace-packages=true
```

This setting makes pnpm copy (rather than symlink) workspace packages into consumer packages, which is required for `pnpm deploy` to function in pnpm 10. It has no effect on local development workflows.

Stages that completed successfully before the failure:
- deps: pnpm install --frozen-lockfile — OK
- builder/prisma generate — OK (with a non-fatal warning about libssl detection on alpine)
- builder/@mento/types build — OK
- builder/@mento/validation build — OK
- builder/nest build — OK (9.6s)
- builder/pnpm deploy — FAILED

The prisma libssl warning (`Prisma failed to detect the libssl/openssl version to use`) is benign on Alpine — Prisma defaults to openssl-1.1.x and the alpine Prisma engine binary handles this correctly at runtime.

---

## Recommendations (priority order)

### P0 — Blocker: pnpm deploy fails

File: `infra/docker/Dockerfile.api` (line 48) + missing `.npmrc`

Fix: Create `/root/Mento/.npmrc` with:
```
inject-workspace-packages=true
```
Without this fix, the API image cannot be built. The web image build has not been smoke-tested — it may hit a similar issue if it uses workspace packages through the standalone copy step (less likely since Next.js standalone handles its own bundling).

### P1 — Security: Host environment leaking into compose config

Do not run `docker compose up` from a shell that has GeekSpace2.0 variables exported. Use `env -i` wrapper or fully populate `.env.prod` with all variable names (even optional ones set to empty string) to prevent host-env bleeding.

### P2 — Security: SENTRY_AUTH_TOKEN via ARG/ENV

Migrate to BuildKit `--secret` to properly handle the token and silence the buildx check warning. Until then the token is not in the runtime image but the CI pipeline will flag a Dockerfile lint failure.

### P3 — Performance: Missing .dockerignore

Add a `.dockerignore` at the repo root to exclude `node_modules`, `.git`, `.next`, `dist`, and other large/irrelevant directories from the build context. This reduces build context transfer time significantly for a monorepo of this size.

Example `/root/Mento/.dockerignore`:
```
**/.git
**/node_modules
**/.next
**/dist
**/coverage
**/.turbo
infra/
docs/
*.md
.env*
!.env.example
```

### P4 — Cosmetic: Caddyfile format

Run `caddy fmt --overwrite infra/docker/Caddyfile` to silence the format warning.

### P5 — Operational: Rate limiting on auth routes

Add Caddy `rate_limit` or rely on NestJS `@nestjs/throttler` (already in dependencies) for OTP endpoints before going live.

---

## Files audited

- `/root/Mento/infra/docker/docker-compose.prod.yml`
- `/root/Mento/infra/docker/Dockerfile.api`
- `/root/Mento/infra/docker/Dockerfile.web`
- `/root/Mento/infra/docker/Caddyfile`
- `/root/Mento/package.json`
- `/root/Mento/pnpm-workspace.yaml`
- `/root/Mento/apps/api/package.json`
