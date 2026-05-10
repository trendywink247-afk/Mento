# Mento

UPSC exam prep platform — chat-based mentorship between Aspirants and Mentors, with an Admin module.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **API:** NestJS + Prisma + PostgreSQL + Redis (Socket.IO with Redis adapter)
- **Web (desktop):** Next.js 15 (App Router) + Tailwind + shadcn/ui
- **Mobile (iOS + Android):** Expo SDK 51+ + Expo Router + NativeWind
- **Auth:** Custom JWT (access + refresh) + Phone OTP via MSG91 (dev mode prints OTP to console)
- **Storage:** Cloudflare R2 (S3-compatible)
- **Push:** Expo Push Notifications

## Repo layout

```
apps/
  api/      NestJS server (HTTP + Socket.IO)
  web/      Next.js (desktop) + admin
  mobile/   Expo (iOS, Android, Web for dev)
packages/
  types/        Shared TS types & DTOs
  api-client/   Typed REST + Socket.IO client
  validation/   Zod schemas
  hooks/        Shared React hooks (no UI)
  config/       ESLint, TS, Prettier base configs
infra/
  docker/   Dockerfiles + compose (local + dev/uat + prod)
  caddy/    Caddyfiles per environment
  scripts/  Deploy / backup helpers
.github/
  workflows/  CI + per-env deploy + mobile (EAS)
```

## Quickstart (local dev)

```bash
# 1. Install
pnpm install

# 2. Start local Postgres + Redis
pnpm db:up

# 3. Apply database schema
pnpm --filter @mento/api db:migrate

# 4. Run all dev servers (api, web, mobile-web)
pnpm dev
```

Local URLs:
- API:    http://localhost:4000
- Web:    http://localhost:3000
- Mobile: http://localhost:8081 (Expo dev), or `pnpm --filter @mento/mobile web` for browser mobile-view

## Env

Copy `.env.example` to `.env` and fill in. For local dev, defaults work — MSG91 is mocked (OTP printed to api console), R2 falls back to local disk.

## Phases

- **Phase 0** — Bootstrap (this scaffolding)
- **Phase 1** — Auth (OTP + JWT)
- **Phase 2** — Chat (Socket.IO + REST)
- **Phase 3** — Admin module
- **Phase 4** — UAT (Server A) and EAS internal builds
- **Phase 5** — Prod (Server B) + store submissions
