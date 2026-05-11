# Mento — Security Audit Findings

> Audit date: 2026-05-11. Targeted at the live MVP code on `main`.

## Severity legend

- **CRITICAL** — data exposure, account compromise, or silent breakage of a security control.
- **HIGH** — exploitable but requires more steps, or a hardening gap that's clearly wrong.
- **MEDIUM** — defense-in-depth gap; not directly exploitable today.
- **LOW** — informational / housekeeping.

## Findings

### SEC-1 (CRITICAL) — Refresh token hash is non-deterministic, refresh is silently broken

`apps/api/src/modules/auth/auth.service.ts`

`hashRefreshToken` uses `bcrypt.hash(token, 8)`. Bcrypt salts every call, so the same plaintext → different hash every call. The lookup `prisma.refreshToken.findUnique({ where: { tokenHash } })` therefore **always fails**.

Cascading effect: on the very first legitimate refresh attempt by any user, the code falls into the "Token reuse — revoke entire family" branch and revokes ALL the user's refresh tokens, signing them out. Any session would have terminated after the access-token TTL (15m).

**Fix:** replace bcrypt with deterministic HMAC-SHA256 keyed by `JWT_REFRESH_SECRET`. HMAC is fast on hot paths and the refresh token already carries enough entropy that a fast hash is fine (it's not a low-entropy user password).

### SEC-2 (HIGH) — OTP code generated with Math.random

`apps/api/src/modules/auth/otp.service.ts:generate6DigitCode`

`Math.floor(100000 + Math.random() * 900000)`. V8's `Math.random()` is fast but is a Xorshift128+ PRNG. An attacker who observed a few prior OTP outputs from the same process could in principle correlate state. Even without that, using a CSPRNG here is the obvious correct choice.

**Fix:** `crypto.randomInt(100000, 1_000_000).toString()`.

### SEC-3 (CRITICAL) — Chat-request list leaks counterpart phone/email

`apps/api/src/modules/chat-requests/chat-requests.service.ts:listForUser`

```ts
return this.prisma.chatRequest.findMany({
  where: { mentorId: userId },
  include: { mentee: { include: { profile: true } } },  // ← full User
})
```

The included `mentee` (or `mentor`) is the raw Prisma `User` row — includes `phone`, `email`, `googleSub`, `passwordHash`, `status`, `bannedAt`. Controller returns it unchanged. So:

- A mentor opening their pending requests sees every requesting mentee's phone number.
- A mentee viewing their own sent requests sees the target mentor's phone number.

Anonymity is a **non-negotiable** principle of the product. This is the worst finding in the codebase.

**Fix:** serialize to an explicit `ChatRequestSummary` DTO with `counterpart: { id, displayHandle, avatarLetter, avatarColor, hasPurpleTick }`.

### SEC-4 (HIGH) — Socket.IO CORS echoes any Origin

`apps/api/src/modules/chat/chat.gateway.ts`

```ts
@WebSocketGateway({ namespace: '/chat', cors: { origin: true, credentials: true } })
```

`origin: true` causes the server to echo whatever Origin header the browser sent (with credentials). Any attacker page can therefore open a WebSocket to `/chat` with the victim's cookies/origin context. Token auth still requires a stolen JWT, but the CORS contract should be tight regardless.

**Fix:** read `CORS_ORIGINS` from env and pass a function that allowlists.

### SEC-5 (MEDIUM) — No app-level rate limiting

Only the OTP service rate-limits (3 unconsumed requests/hour per phone). Login verify, /me, /chat-requests, /mentors, journals etc. have no rate limit. Caddy will likely catch egregious abuse in prod but local + Caddy-less deployments are wide open.

**Fix:** `@nestjs/throttler` global guard. Default 100 req/min per IP, tighter on auth routes.

### SEC-6 (MEDIUM) — Pino redact paths incomplete + helmet defaults

`apps/api/src/app.module.ts:LoggerModule` redacts `authorization`, `cookie`, `*.password`, `*.token`. Missing: `phone`, `email`, `*.aadhaarHash`, `*.codeHash`, `*.tokenHash`, `*.refreshToken`. Also Pino does not redact request bodies by default, so an OTP request body lands in info logs as `{ phone: "+91..." }`.

`helmet()` runs with defaults. `x-powered-by: Express` header is fully removed (good). `frameguard` is on by default. But: `noSniff`, HSTS in development, CSP — could tighten.

**Fix:** expand redact list + explicit helmet config.

### SEC-7 (LOW) — Display handle suffix uses Math.random

`apps/api/src/common/anonymity.ts:generateDisplayHandle`

Only a 4-digit random suffix; collision rate is the same regardless of PRNG, but consistency with SEC-2 suggests we switch to `crypto.randomInt` everywhere.

### Findings reviewed and accepted as-is

- **No CSRF tokens on web**: web uses `Authorization: Bearer` from `localStorage`, not cookies. CSRF doesn't apply. Acceptable. If we add cookie sessions for SSR auth later, revisit.
- **JWT in localStorage**: vulnerable to XSS if any XSS exists. React-rendered content is escaped by default and we never `dangerouslySetInnerHTML` user content. Accept for MVP; revisit if we add WYSIWYG editors or third-party widgets.
- **Self-hosted Socket.IO single-instance**: presence/typing only fan out within one process. Redis adapter gated behind `SOCKET_REDIS_ADAPTER=true` for multi-instance prod. Documented.
- **Admin bootstrap via env**: whoever controls the server controls who's admin. That's a hosting/secrets concern, not an app bug.
- **Pre-signed R2 URLs not yet implemented**: Phase F. Will be admin-gated for verification document uploads.
- **DTO whitelist**: `ValidationPipe` configured with `whitelist: true, forbidNonWhitelisted: true` — mass-assignment safe. Good.
- **Prisma parameterized queries**: all queries go through Prisma's typed API. No raw SQL. Injection-safe.

## Fix order (this session)

1. SEC-1 — refresh token HMAC
2. SEC-3 — chat-requests anonymization
3. SEC-2, SEC-7 — crypto.randomInt for OTP + handles
4. SEC-4 — Socket.IO CORS
5. SEC-5 — throttler
6. SEC-6 — pino redact + helmet hardening
7. Test all fixes (curl) + Playwright E2E
