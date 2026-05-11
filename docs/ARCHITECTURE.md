# Mento — Architecture

> What we built, why, and what the boundaries are. Skim this whenever you forget how a piece fits.

## High-level

```
┌─────────────────────────────────────────────────────────────────┐
│                  Clients (3 surfaces)                            │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐   │
│  │ Next.js 15 │  │ Expo iOS   │  │ Expo Android             │   │
│  │ desktop    │  │ + Web fall │  │                          │   │
│  │ (web,3030) │  │ back for   │  │                          │   │
│  │            │  │ dev test   │  │                          │   │
│  └─────┬──────┘  └─────┬──────┘  └────────────┬─────────────┘   │
│        │ HTTPS+WSS     │                      │                  │
└────────┼───────────────┼──────────────────────┼──────────────────┘
         ▼               ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  NestJS API (HTTP + Socket.IO /chat namespace, port 4000)        │
│  Modules: auth, users, onboarding, mentors, chat, chat-requests, │
│  assignments, journals, admin, health                            │
└────────┬──────────────────┬───────────────┬────────────────┬────┘
         ▼                  ▼               ▼                ▼
   ┌──────────┐       ┌──────────┐    ┌────────────┐  ┌──────────┐
   │ Postgres │       │  Redis   │    │   R2       │  │ MSG91    │
   │  :5433   │       │  :6380   │    │ (pending)  │  │ (prod)   │
   │  Prisma  │       │ Sessions │    │            │  │          │
   └──────────┘       │ Pub/Sub  │    └────────────┘  └──────────┘
                      └──────────┘
```

## Module map (NestJS)

`apps/api/src/`

| Module | Purpose | Routes |
|---|---|---|
| `health` | Liveness / readiness | `GET /healthz`, `/readyz` (public) |
| `auth` | OTP, JWT issue + rotation, logout, refresh | `POST /auth/{otp/request,otp/verify,refresh,logout}` |
| `users` | Current-user accessor | `GET /me` |
| `onboarding` | Role pick (pre-auth), event tracking, Mirror, mentor onboarding submission, onboarding state | `POST /onboarding/{role,event,mirror,mentor}` (mixed), `GET /onboarding/state` |
| `mentors` | Discovery (filterable list) + profile detail with metrics + reviews | `GET /mentors`, `/mentors/:id` |
| `chat-requests` | 160-char intro request lifecycle | `POST /chat-requests`, `GET /chat-requests`, `PATCH /:id/{accept,decline,archive}` |
| `chat` | Conversation REST + Socket.IO gateway | `GET /conversations`, `/conversations/:id/messages` + `/chat` WS namespace |
| `assignments` | Admin pair mentor↔aspirant + opens conversation | `GET /assignments`, `POST /assignments`, `DELETE /assignments/:id` |
| `journals` | Personal + categorized + shared (presence-gated) journals + audit log | `GET /journals`, `POST /journals`, `GET/POST/PATCH/DELETE /journals/:id`, `/entries/:eid`, `/save-from-chat` |
| `admin` | Users list, role change, mentor approval, audit log | `GET /admin/users`, `PATCH /admin/users/:id/role`, `POST /admin/mentors/:id/approve`, `GET /admin/audit-logs` |
| `database` | Global PrismaService | — |
| `common/anonymity.ts` | Handle generator + letter avatar logic | — |

Global guards via `APP_GUARD`: `JwtAuthGuard` (skipped on `@Public()`), `RolesGuard` (enforces `@Roles(Role.X)`).

## Data model boundaries

- **Public identity (`Profile`)**: `displayHandle`, `avatarLetter`, `avatarColor`, `hasPurpleTick`, `bio`, `city`, `state`, `language`. Safe to return in any API response.
- **Account (`User`)**: phone, email, googleSub, passwordHash, role, status. **Never return phone/email/googleSub in non-admin responses.**
- **PII (`VerificationDocument`)**: aadhaarUrl + aadhaarHash + hall ticket + marks sheet + bank account. Admin-only access enforced at the router level via `@Roles(Role.ADMIN)`.
- **Denylist (`MentorDenylist`)**: Aadhaar hash → permanent mentor ban. Checked when a mentor account tries to sign up with that Aadhaar.
- **Mentee data (`MenteeProfile`)**: journey stage, knowledge (JSONB), challenges, mirrorCompletedAt. Some fields may be shared with mentors when matching; emotional reflections stay private.
- **Mentor data (`MentorProfile`)**: journey type, attempt history (JSONB), languages, guidance categories, hourly rate, verification flag.
- **Conversations + Messages**: idempotent on `(senderId, clientMessageId)`. Deletes are soft (`deletedAt`).
- **Journals**: per-user + per-category + optional `conversationId` for shared journals. Audit log tracks every edit.
- **ConversationPresence**: tracks who is currently active in a conversation thread. Used to gate edits on shared journals.

## Real-time chat protocol

Single namespace `/chat`. JWT in `socket.auth.token`.

**Events (client → server):**
- `message:send { conversationId, type, body?, attachmentUrl?, clientMessageId }` (ACK with persisted message)
- `message:delivered { messageId }`
- `message:read { messageId }`
- `typing:start { conversationId }` / `typing:stop`
- `conversation:join { conversationId }` (also sets presence active)
- `conversation:leave { conversationId }` (clears presence active)

**Events (server → client):**
- `message:new` (broadcast to `conv:<id>` room + personal `user:<id>` room)
- `message:status { messageId, deliveredAt?, readAt? }`
- `typing:start` / `typing:stop` (broadcast to room, excluding sender)
- `presence:online` / `presence:offline` (global, by user)
- `conversation:created`

**Scaling**: `@socket.io/redis-adapter` gated behind `SOCKET_REDIS_ADAPTER=true` env. Off in dev (single node).

## Frontend route map

### Web (`apps/web/app/`)

```
(public)/
  page.tsx                # / — marketing landing
  get-app/page.tsx        # mobile UA hard-redirect destination
(onboarding)/
  role/page.tsx           # pre-auth role pick
  welcome/page.tsx        # mentee timed flash
  mentor-welcome/page.tsx # mentor philosophy
  mirror/page.tsx         # 7-step Mirror wizard
  mentor/page.tsx         # 4-step mentor wizard
  submitted/page.tsx      # mentor waiting verification
(auth)/
  login/page.tsx          # phone input
  otp/page.tsx            # code input + post-verify routing
(app)/                    # role-gated by auth-store tokens
  dashboard/page.tsx
  journals/page.tsx
  journals/[id]/page.tsx
  chat/page.tsx
  chat/[id]/page.tsx
  mentors/page.tsx
  mentors/[id]/page.tsx
  profile/page.tsx        # (placeholder)
  admin/                  # role-gated by ADMIN check in layout
    page.tsx
    users/page.tsx
    assignments/page.tsx
    audit/page.tsx
middleware.ts             # mobile UA hard-redirect to /get-app
```

### Mobile (`apps/mobile/app/`)

```
_layout.tsx               # root: providers + auth gate + onboarding redirect
(onboarding)/
  _layout.tsx
  role.tsx
  welcome.tsx
  mentor-welcome.tsx
  mirror.tsx
  mentor.tsx
  submitted.tsx
(auth)/
  _layout.tsx
  login.tsx
  otp.tsx
(tabs)/
  _layout.tsx             # 5 tabs: Home, Journals, Chats, Mentors, Profile
  index.tsx               # Home
  journals/{_layout,index,[id]}.tsx
  chat/{_layout,index,[id]}.tsx
  mentors/{_layout,index,[id]}.tsx
  profile.tsx
```

## Shared packages

- `@mento/types` — `Role`, `User`, `Profile`, `AvatarLetter`, `AvatarColor`, `Message`, `Conversation`, `ConversationSummary`, `AnonymousIdentity`, `JourneyStage`, `SubscriptionTier`, `JournalCategory`, etc. + Socket.IO event types
- `@mento/api-client` — `ApiClient` class with typed methods for `auth`, `users`, `onboarding`, `mentors`, `chatRequests`, `chat`, `journals`, `admin` namespaces. Also `createSocketClient`.
- `@mento/validation` — Zod schemas (phone, OTP, profile, message, presign-upload, register-push-token)
- `@mento/hooks` — pure React hooks (useApiHealth, …)
- `@mento/config` — base tsconfig + prettier

## Anonymity flow

1. User signs up via phone OTP. `createUserWithProfile` allocates a `displayHandle` (e.g., `Aspirant_8421`) via retry on conflict, assigns `avatarLetter` = `B` (beginner default) and `avatarColor` per the map.
2. On Mirror submit, letter is bumped based on `journeyStage` (P/M/I if they've cleared).
3. On mentor onboarding submit, letter is bumped per `journeyType` + `isFoundingPartner`.
4. Admin verification of mentor credentials sets `mentorProfile.isVerified=true` and `profile.hasPurpleTick=true` (when extra credentials uploaded).
5. All API responses use `displayHandle` and avatar fields. Phone/email never leave the api except in `/me` and admin endpoints.

## Future modules (Phase 2+ extension points)

Each new module follows the same NestJS pattern. Drop-in:
- `exams/` + `questions/` + `attempts/` — mock tests
- `leaderboards/` — Redis ZSETs `lb:{examId}:{period}`
- `payments/` — Razorpay wrapper for subscriptions + 1:1 session escrow
- `ai-tutor/` — LLM-backed tutoring layer (Anthropic/OpenAI), new socket event
- `groups/` — serving-officer-led group sessions

DB-wise, the schema already includes stubs for `Subscription`, `Session`, `WalletTransaction`. Phase 2 adds `Exam`, `Question`, `Attempt`, `LeaderboardEntry`.
