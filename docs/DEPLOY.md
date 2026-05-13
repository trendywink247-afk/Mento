# Mento — Production Deploy Guide

> See `docs/RUNBOOK.md` for day-to-day ops and troubleshooting.
> See `.env.prod.example` for every required environment variable.

---

## 1. Server provisioning

### Recommended specs (MVP / staging, ~10k MAU)
| Resource | Minimum | Comfortable |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Bandwidth | 1 Gbps shared | 1 Gbps dedicated |

AWS: `t3.medium` (2 vCPU, 4 GB). Hetzner: `CX32`. DigitalOcean: `s-2vcpu-4gb`.

### Required software

```bash
# Docker (official install script — Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out + back in

# Docker Compose v2 (bundled with Docker Desktop; verify on server)
docker compose version   # should print v2.x

# (Optional) Caddy standalone — not needed if using the caddy container
```

### DNS

Point the following A records to the server IP before first deploy:

| Hostname | Record |
|---|---|
| `mento.in` | A → server IP |
| `www.mento.in` | A → server IP |
| `api.mento.in` | A → server IP |

Caddy will provision TLS certificates automatically via Let's Encrypt once DNS resolves.

---

## 2. First-time deploy

### 2a. Clone the repo

```bash
git clone https://github.com/<org>/mento.git /srv/mento
cd /srv/mento
```

### 2b. Prepare the environment file

```bash
cp .env.prod.example .env.prod
# Fill every variable. Required at minimum:
#   POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
#   NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL, ADMIN_BOOTSTRAP_PHONE
nano .env.prod
```

### 2c. Validate the compose file

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod config
# Must print the resolved YAML with no errors before continuing.
```

### 2d. Start all services

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod up -d
```

Boot order (enforced by healthcheck `depends_on`):
1. `postgres` + `redis` start and pass health checks.
2. `api` starts, runs, passes `/healthz`.
3. `web` starts, runs, passes `/`.
4. `caddy` starts last and begins serving traffic + provisioning TLS.

### 2e. Run database migrations

```bash
# Apply all pending Prisma migrations (safe for first deploy and every update)
docker exec mento-api-prod \
  node node_modules/.bin/prisma migrate deploy \
    --schema prisma/schema.prisma
```

### 2f. Seed the admin user

```bash
# Requires ADMIN_BOOTSTRAP_PHONE to be set in .env.prod
docker exec mento-api-prod node dist/prisma/seed.js
```

### 2g. Verify

```bash
# API health
curl https://api.mento.in/healthz
# → {"status":"ok"}

# Web
curl -I https://mento.in
# → HTTP/2 200
```

---

## 3. Routine updates (tag-based)

The CI workflow (`.github/workflows/deploy.yml`) builds and pushes Docker images on every `v*` tag push.

```bash
# On your local machine
git tag v1.2.3
git push origin v1.2.3
```

The workflow builds `mento-api` and `mento-web` images, tags them `v1.2.3` + `latest`, and pushes to GHCR.

Once the SSH deploy step is enabled (see scaffold comments in `deploy.yml`), the server automatically pulls and restarts. Until then, deploy manually:

```bash
# On the server
cd /srv/mento
git pull --ff-only origin main

IMAGE_TAG=v1.2.3 \
  docker compose \
    -f infra/docker/docker-compose.prod.yml \
    --env-file .env.prod \
    pull

IMAGE_TAG=v1.2.3 \
  docker compose \
    -f infra/docker/docker-compose.prod.yml \
    --env-file .env.prod \
    up -d --remove-orphans

# Run any new migrations
docker exec mento-api-prod \
  node node_modules/.bin/prisma migrate deploy \
    --schema prisma/schema.prisma

# Prune dangling images
docker image prune -f
```

---

## 4. Rollback

Pin the previous image tag in the compose `up` call:

```bash
IMAGE_TAG=v1.2.2 \
  docker compose \
    -f infra/docker/docker-compose.prod.yml \
    --env-file .env.prod \
    up -d
```

No schema rollback is needed unless the migration was destructive. If you need to roll back a migration, restore from the pre-migration backup (see §5) and apply only the migrations up to the previous version.

---

## 5. Backups

### Automated pg_dump (recommended: cron on the server)

```bash
# Add to /etc/cron.d/mento-backup
0 2 * * * root docker exec mento-postgres-prod \
  pg_dump -U mento mento | gzip > /backups/mento-$(date +\%Y\%m\%d).sql.gz

# Keep 30 days
0 3 * * * root find /backups -name "mento-*.sql.gz" -mtime +30 -delete
```

### Off-site copy

Sync `/backups/` to an S3 bucket or Cloudflare R2 using `rclone`:

```bash
rclone sync /backups/ r2:mento-backups/pg/ --progress
```

### Restore

```bash
gunzip -c /backups/mento-YYYYMMDD.sql.gz | \
  docker exec -i mento-postgres-prod psql -U mento -d mento
```

---

## 6. Checking logs

```bash
# All services
docker compose -f infra/docker/docker-compose.prod.yml logs -f

# Single service
docker compose -f infra/docker/docker-compose.prod.yml logs -f api
docker compose -f infra/docker/docker-compose.prod.yml logs -f web
docker compose -f infra/docker/docker-compose.prod.yml logs -f caddy
```

---

## 7. TLS / Caddy

Caddy manages TLS automatically. Certificates are stored in the `mento_caddy_data` named volume and renewed automatically before expiry.

If a certificate fails to provision (check `docker logs mento-caddy-prod`):
- Confirm DNS is resolving correctly: `dig mento.in @1.1.1.1`.
- Confirm ports 80 and 443 are open in the firewall.
- Caddy retries automatically; no manual intervention is usually needed.

---

## 8. Firewall rules (UFW example)

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy redirects to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw allow 443/udp   # HTTP/3 (QUIC) — optional
ufw enable
```

All internal ports (5432, 6379, 4000, 3000) must remain closed to the internet. They are only reachable within the `mento_internal` Docker network.
