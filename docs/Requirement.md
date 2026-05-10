# Mento — Consolidated Spec & Expo Build Plan

> Anonymous, peer-led mentorship platform. Starts with UPSC. WhatsApp-simple UX. Built on the principle that the person who *almost* cleared carries the same wisdom as the person who did.

---

## Part 1 — Sorted Product Spec

### 1.1 Vision (one paragraph)

Mento is a place — not a platform — where someone who has walked a hard path turns around and holds a light for the person still walking it. We start with UPSC because the people who have lived inside that crucible carry rare values (discipline, ethics, empathy, civic depth) and the world isn't using that wisdom well. Anonymity is the infrastructure that makes honest conversation possible. We are not coaching, not content, not a doubt-clearing service, not therapy, not a social network. We are one human, anonymously, sitting with another.

### 1.2 User Types

| User | Definition | Onboarding Path |
|---|---|---|
| **Mentee** | New aspirant, ≤1 year in, lacking clarity. Primary target. | Role pick (pre-login) → emotional welcome → auth → questionnaire → mirror/self-assessment → home (Chats) |
| **Mentor** | Cleared Prelims **at least once** (Mains-cleared preferred). | Role pick (pre-login) → philosophy intro → auth → UPSC journey form → credential upload → Aadhaar → bank → manual verification → home |
| **Coordinator** | Externally hired ops people running group sessions, WhatsApp support, mentee/mentor concierge. Separate dashboard. | Invite-only. No public signup. |
| **Admin** | Internal Mento team (founders + ops). Web-based. | Dashboard for verifications + onboarding-funnel analytics + payouts + moderation + ban enforcement |

### 1.3 Core Principles

1. Anonymity is non-negotiable. No real names, no photos. Profile = a single letter on a colored tile.
2. No star ratings on humans. Only positive written reviews surfaced.
3. Charge from day 1.
4. Movement everywhere (Lottie/Reanimated).
5. WhatsApp-grade simplicity.
6. Honour the struggle.
7. Never promise outcomes.

### 1.4 Onboarding Flow (Mentee) — 12 screens

1.1→1.3 Emotional welcome (timed flash)
2.1→2.4 What it's NOT
3 Self-reflection intro
4 Logo with motion
5 Auth (Google / Mobile only — email dropped)
6 Mirror intro
7 Journey classification (9 stages)
8 Background (beginners only)
9 Honest reflection screen
10 Knowledge sliders (11 subjects)
11 Challenges (multi-select, 12 options)
12 Privacy notice

### 1.5 Onboarding Flow (Mentor)

Philosophy → Anonymity guidelines → Self-protection → Auth → UPSC journey form (10 options) → Credentials (Mains hall ticket required, marks sheet optional) → Aadhaar → Bank/UPI → Manual verification → Purple tick on approval

### 1.6 App Shell

Bottom nav 5 tabs:
- Mentee: Journals · Calls · **Chats (default)** · Mentors · Profile
- Mentor: Journals · Calls · **Chats (default)** · Mentees · Profile

### 1.7 Chats — Free Tier Mechanics

- 160-char intro request to one mentor; after accept, open-ended.
- Top bar archive (WhatsApp-style): sent / pending / archived / unanswered.
- Persistent safety banner: "Please avoid sharing personal details."
- Report message / Report user (long-press) → moderation queue.

### 1.8 Mentor Discovery

Default sort: online. Filters: Prelims/Mains/Interview status, online, optional subject, language, price range.
Profile shows: letter avatar, journey timeline (year-by-year), marks, optional, guidance categories, languages, metrics, positive-only written reviews. Two CTAs: Request for Chat (160-char intro), Request 1-on-1 Session.

### 1.9 1-on-1 Session — UI in MVP, payment stubbed; real escrow in v1.1 (August)

MVP: availability calendar, request flow, mentor accept/decline, payment screen with `simulated` status.
v1.1: real Razorpay escrow, 30-min mentor-accept timeout → auto-refund, voice/video via 100ms, opt-in transcription via Deepgram (20-min chunks → mentor journal).

### 1.10 Journals — The Differentiator

Categories: Personal · Prelims (Polity, History, Geography, Economy, Environment, Sci-Tech, CSAT, Current Affairs) · Mains (GS1-4, Essay, Optional) · Interview · Per-mentor shared journals.

Shared journal edit gating:
- Edit enabled only when both mentee+mentor are simultaneously active in that thread.
- Either side leaves/goes idle → flips to read-only.
- Every edit writes to `audit_log`: {user_id, action, diff, timestamp}.
- Chat closed/archived → journal locks permanently as historical record.

Chat-to-journal: long-press any chat message → "Save to journal" → pick category. WhatsApp forward-style UX.

### 1.11 Broadcast Mentor Request

Plus button on Mentors tab → free-text + filters (language, mains exp, ethics/essay/interview). Backend matches and pushes to mentor request feed.

### 1.12 Pricing — Tiered (placeholders, validate in week 2)

| Tier | Price | Inclusions |
|---|---|---|
| Basic | ₹399/mo | Anonymous chat (open), personal journals, mentor discovery, free intro requests |
| Pro | ₹599/mo | Basic + broadcast requests, saved chat-to-journal, priority in mentor feed |
| Max | ₹999/mo | Pro + 1:1 session credits (v1.1), group session access, verified-mentor priority |

1:1 paid sessions: ₹400/hr default or mentor-defined (separate, v1.1).

### 1.13 Sample Questions for Beginners

Curated tap-to-send library to reduce friction.

### 1.14 Admin, Analytics & Companion Web

Three dashboards:
1. Admin (founders + ops): verification queue, funnel analytics, moderation, payouts, subscription analytics
2. Coordinator (external ops): group sessions, concierge, onboarding hand-holding (no PII)
3. Companion Web (public): full app mirror — signup, mentors, chat, journals. SEO landing pages.

PostHog event for every onboarding step transition.

### 1.15 What Mento Is NOT

Not coaching, content, doubt-clearing, therapy, social network, leaderboard. Every feature decision passes this filter.

### 1.16 Safety & Banning

Hard rule: "If somebody leaves private details, both will be banned. No refund."

- Detection MVP: user reports + manual admin review
- Detection v1.1: regex/NLP scan
- Enforcement: first violation = both parties banned, no refund
- Asymmetric reinstatement: banned mentees can rejoin, banned mentors permanently denied (Aadhaar hash denylist)
- Appeals: log via email, manual
- Audit: every ban writes `{user_id, reason, evidence_message_ids[], banned_by_admin, banned_at}`

### 1.17 Profile Letter Codes (locked)

| Letter | Meaning | Tile |
|---|---|---|
| B | Beginner | soft slate |
| A | Aspirant (multi-attempt, no clear) | warm amber |
| P | Prelims cleared | sky blue |
| M | Mains written | forest green |
| I | Interview attended | deep purple |
| F | Founding mentor partner | gold gradient |

Purple verification tick overlaid bottom-right for users with extra credentials (marks sheet uploaded + admin verified).

### 1.18 Mentor Profile Structure

Top 60-70%: Letter avatar + handle (e.g., `Aspirant_8421`), year-by-year UPSC timeline, marks (optional), optional subject, comfortable-in categories, languages.
Bottom 30-40%: metrics, positive-only written reviews, two CTAs.

### 1.19 Strategic Launch Calendar (UPSC Peak Timings)

8 predictable peaks per year. Mento's calendar maps to them:
1. Prelims day +48hr (May 24-26) — **highest peak**
2. 2-3 weeks post-Prelims (new batches)
3. Prelims results (14-28 days post-exam)
4. Mains writing (Sep-Oct)
5. **Post-Mains — mentor recruitment peak, v1.1 launches here (Aug)**
6. Mains-result-wait → Interview-wait (~3 months)
7. Interview phase — **peer-to-peer interview practice (v1.2)**
8. Interview results
- Apr-May pre-Prelims = quiet build window

Year-1: launch MVP → ride one cycle → data → AI assist features by May 2027.

### 1.20 Coordinator Dashboard

Post-MVP if scope-tight. Web-only, read-only PII-stripped views.

---

## Part 2 — Expo + FastAPI + Postgres Build Plan

### 2.1 Tech Stack (spec-recommended — owned-stack on DigitalOcean)

| Layer | Choice |
|---|---|
| Mobile + Companion Web | Expo SDK 52 + Expo Router + react-native-web + TypeScript |
| State | Zustand + TanStack Query |
| Admin + Coordinator dashboards | React + Vite + TanStack Router |
| Backend | FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2 |
| Database | DigitalOcean Managed Postgres |
| Migrations | Alembic |
| Cache + Queue + Pub/Sub | Redis |
| Background jobs | arq (async Redis queue) |
| Auth | JWT (python-jose) + MSG91 OTP + Authlib (Google OAuth) |
| Realtime chat | Stream Chat (recommended) OR FastAPI WebSockets + Redis Pub/Sub |
| File storage | DigitalOcean Spaces (S3-compat) + boto3 |
| Voice/video | 100ms (v1.1) |
| Transcription | Deepgram (v1.1) |
| Payments | Razorpay |
| Push | Expo Notifications via exponent-server-sdk-python |
| Analytics | PostHog self-hosted on DO |
| Error monitoring | Sentry |
| Reverse proxy | Caddy |
| Deployment | Docker Compose on DO droplet |
| Client codegen | openapi-typescript-codegen |
| Animation | Reanimated 3 + Lottie |

### 2.2 Architecture Decisions Worth Naming

1. Single app, role-based shell. One Expo codebase; `role` claim in JWT routes user to mentee or mentor tab group.
2. Anonymity model. Public `profiles` table = display_handle + avatar_letter + avatar_color only. PII on `verification_documents` — app-level authz, router-scoped admin gate, two-role Postgres user.
3. Mentor matching = SQL WHERE clause. No engine. ML matching post-PMF.
4. Journals as content blocks. Each entry: {type, content, source_message_id?, created_at}. Type ∈ manual_text|saved_chat|call_transcript_chunk.
5. Auto-locked shared journals via Postgres trigger or arq event.
6. Pay-then-accept escrow. Razorpay debit → wallet_transactions (status='held'). arq schedules session_timeout_check.
7. API contract first. /openapi.json source of truth. Mobile + admin pull typed SDK via codegen.
8. WebSocket chat (if self-building). Redis Pub/Sub per thread_id, sticky sessions on Caddy.

### 2.3 MVP Scope

Ship in v1 (target 14 days, 2 engineers parallel):
- Onboarding (12 screens) — role pick before login
- Auth (Google + Mobile OTP via MSG91 — drop email)
- Mentee questionnaire + Mirror
- Mentor signup + verification queue
- Mentor discovery + filters + year-by-year journey profile
- Open anonymous chat (no caps, abuse rate-limits only)
- Personal + Prelims + Mains journals
- Shared mentor-mentee journals with presence-based edit gating + audit log
- Chat-to-journal save
- 1:1 booking UI with stubbed payment
- Razorpay subscription (Basic/Pro/Max placeholders)
- Profile + letter avatar
- Report message/user + admin moderation queue
- Admin dashboard
- Companion web mirror

Defer to v1.1 (August):
- Real Razorpay session escrow
- Voice/video + transcription
- Broadcast mentor request
- Push notifications
- Coordinator dashboard
- Automated PII detection
- Group session feature

Post-PMF:
- Peer-to-peer interview practice with AI
- ML mentor matching
- Multi-language UI
- New segments (Class 7/12/young-pro)

### 2.7 Resolved Decisions

- Stream Chat for MVP
- Email auth dropped (Mobile OTP + Google only)
- Free chat open in MVP (no caps)
- Pricing tiered (Basic/Pro/Max ₹399/₹599/₹999 placeholders)
- 1:1 paid sessions: UI in MVP, payment stubbed
- Companion web mirror via Expo react-native-web (shared codebase)
- Profile letter taxonomy locked: B/A/P/M/I/F + purple verification overlay
- PII detection: user reports + manual review (MVP); regex/NLP v1.1
- Banning: both banned, no refund, asymmetric reinstatement
- Shared-journal edit gate: presence-based + audit log
- Two-role Postgres user

### 2.8 Sprint Plan (14 days, 2 engineers)

Week 1
- D1 scaffold + auth foundations + design tokens + animation primitives
- D2 Auth (MSG91 OTP + Google + JWT)
- D3 Onboarding screens 1-4 + role-pick
- D4 Mentee Mirror flow (screens 6-11)
- D5 Mentor onboarding + Aadhaar/hall-ticket upload + admin verification + letter avatar
- D6 App shell, tab nav, profile, mentor profile timeline
- D7 Mentor discovery + filters + safety banner

Week 2
- D8 Chat (Stream) + report flow
- D9 Journals (personal, prelims, mains) + presence-gated shared + audit log
- D10 Chat-to-journal save + 1:1 booking UI (stubbed payment)
- D11 Razorpay subscription tiers + paywall + webhook
- D12 Admin moderation + funnel analytics + companion web polish
- D13 QA iOS+Android+web, copy review, animation polish, internal beta
- D14 Hotfix + invite first 50 + companion web public

### 2.9 Risks

- Mentor supply: thin pool of cleared-and-willing mentors at ₹400/hr
- Anonymity vs trust: pay ₹199/mo to chat with anonymous person
- Chat abuse at scale: need moderation from day 1
- Subscription churn: deliver value moment within 48 hours
- PII handling without RLS: two-role DB user + router-level admin dep + tests

---

## Appendix — Copy Bank (verbatim)

> "We honour the struggle."
> "Anonymity is not a feature — it is the condition that makes honesty possible."
> "Be brutally honest with yourself. Grade yourself lower than you think. No one is here to judge you."
> "We don't appreciate rating humans."
> "If you are also preparing for UPSC, please protect your own preparation time."
> "You gave years to something larger than yourself. Someone out there is exactly where you were. You can be the person you needed then."
