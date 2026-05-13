# Mento Analytics Event Taxonomy

All events are captured via PostHog `capture()`. Autocapture is OFF — every event listed here is explicit.

Anonymity guarantee: **no event may carry phone, email, displayHandle, aadhaar, name, or googleSub**. Only user UUID (set via `identify()` once at login), role, tier, category, journey stage enum values, and counts are permitted.

---

## Event index

| Event constant | Event string | Platform | When it fires | Props |
|---|---|---|---|---|
| `AUTH_OTP_REQUESTED` | `auth.otp_requested` | Web + Mobile | User submits phone number and the OTP is dispatched | — |
| `AUTH_OTP_VERIFIED` | `auth.otp_verified` | Web + Mobile | OTP code accepted by server | `role` |
| `AUTH_GOOGLE_SIGNIN` | `auth.google_signin` | Web | Google GSI flow completes successfully | — |
| `AUTH_SIGNUP_NEW` | `auth.signup_new` | Web + Mobile | First-ever sign-in (new account created) | `role` |
| `AUTH_SIGNUP_RETURNING` | `auth.signup_returning` | Web + Mobile | Returning user signed in | `role` |
| `ROLE_PICK_VIEWED` | `onboarding.role_pick_viewed` | Web + Mobile | Role selection screen rendered | — |
| `ROLE_PICK_SELECTED` | `onboarding.role_pick_selected` | Web + Mobile | User taps Aspirant or Mentor card | `role` (`'ASPIRANT'` or `'MENTOR'`) |
| `WELCOME_FLASH_VIEWED` | `onboarding.welcome_flash_viewed` | Web + Mobile | Welcome flash sequence screen mounts | — |
| `WELCOME_FLASH_COMPLETED` | `onboarding.welcome_flash_completed` | Web + Mobile | All flash lines played through | — |
| `WELCOME_FLASH_SKIPPED` | `onboarding.welcome_flash_skipped` | Web + Mobile | User taps Skip during flash sequence | — |
| `MIRROR_STARTED` | `onboarding.mirror_started` | Web + Mobile | Mirror intro screen shown | — |
| `MIRROR_STEP_COMPLETED` | `onboarding.mirror_step_completed` | Web + Mobile | User advances past a Mirror step | `step` (`'journey'`, `'background'`, `'reflection'`, `'knowledge'`, `'challenges'`, `'privacy'`) |
| `MIRROR_COMPLETED` | `onboarding.mirror_completed` | Web + Mobile | Mirror form submitted successfully | `journeyStage` (enum value) |
| `MENTOR_ONBOARDING_STARTED` | `onboarding.mentor_started` | Web + Mobile | Mentor journey step renders | — |
| `MENTOR_STEP_COMPLETED` | `onboarding.mentor_step_completed` | Web + Mobile | Mentor advances past a step | `step` (`'history'`, `'subjects'`, `'reach'`) |
| `MENTOR_HISTORY_ADDED` | `onboarding.mentor_history_added` | Web | User adds another attempt year row | — |
| `MENTOR_VERIFICATION_SUBMITTED` | `onboarding.mentor_verification_submitted` | Web + Mobile | Mentor journey form submitted | `journeyType` (enum value) |
| `MENTOR_CREDENTIALS_DOC_UPLOADED` | `onboarding.mentor_credentials_uploaded` | Web | Document upload succeeds | `kind` (`'aadhaar'`, `'hall_ticket'`, `'marks_sheet'`) |
| `MENTOR_VERIFICATION_APPROVED` | `onboarding.mentor_verification_approved` | — | Reserved — not yet wired (admin action) | — |
| `MENTORS_LIST_VIEWED` | `discovery.list_viewed` | Web + Mobile | Mentors list page mounts | — |
| `MENTORS_FILTER_APPLIED` | `discovery.filter_applied` | Web + Mobile | User applies one or more filters | `activeCount` (web) or `filter` (mobile) |
| `MENTOR_PROFILE_VIEWED` | `discovery.profile_viewed` | Web + Mobile | Mentor detail page loads | `mentorId` (UUID) |
| `CHAT_REQUEST_SENT` | `chat.request_sent` | Web + Mobile | Aspirant sends a 160-char intro request | `mentorId` (UUID) |
| `CHAT_REQUEST_ACCEPTED` | `chat.request_accepted` | — | Reserved — wired via server OnboardingEvent | — |
| `CHAT_REQUEST_DECLINED` | `chat.request_declined` | — | Reserved — not yet wired | — |
| `CHAT_FIRST_MESSAGE_SENT` | `chat.first_message_sent` | Web + Mobile | First message in a new conversation | — |
| `MESSAGE_SENT` | `chat.message_sent` | Web + Mobile | Any message sent | — |
| `MESSAGE_REPORTED` | `moderation.message_reported` | Web + Mobile | User reports a chat message | `reason` (mobile only) |
| `JOURNAL_LIST_VIEWED` | `journal.list_viewed` | Web + Mobile | Journals index page mounts | — |
| `JOURNAL_OPENED` | `journal.opened` | Web + Mobile | User opens or creates a journal | `category` (e.g. `'PRELIMS_POLITY'`) |
| `JOURNAL_ENTRY_CREATED` | `journal.entry_created` | Web + Mobile | User saves a journal entry | `category` |
| `JOURNAL_SHARED_WITH_MENTOR` | `journal.shared` | — | Reserved — not yet wired | — |
| `CHAT_TO_JOURNAL_SAVED` | `journal.chat_saved` | Web + Mobile | Message saved from chat to journal | `category` |
| `PRICING_VIEWED` | `payments.pricing_viewed` | Web | Public pricing page mounts | — |
| `UPGRADE_VIEWED` | `payments.upgrade_viewed` | Web | Upgrade page mounts | `initialTier` |
| `UPGRADE_TIER_SELECTED` | `payments.tier_selected` | Web | User clicks Pay/Activate button | `tier` |
| `CHECKOUT_OPENED` | `payments.checkout_opened` | Web | Razorpay checkout modal opens | `tier` |
| `SUBSCRIPTION_ACTIVATED` | `payments.subscription_activated` | Web | Subscription goes active | `tier`, `simulated` |
| `SUBSCRIPTION_CANCELLED` | `payments.subscription_cancelled` | Web | User confirms downgrade to FREE | — |
| `PAYWALL_SHOWN` | `payments.paywall_shown` | — | Reserved — not yet wired | `requiredTier` |
| `SESSION_REQUEST_SENT` | `session.request_sent` | Web | User opens 1-on-1 booking sheet | `mentorId` (UUID) |
| `SESSION_REQUEST_ACCEPTED` | `session.request_accepted` | — | Reserved | — |
| `SESSION_REQUEST_CANCELLED` | `session.request_cancelled` | — | Reserved | — |
| `APP_OPENED` | `app.opened` | — | Reserved | — |
| `APP_INSTALLED` | `app.installed` | — | Reserved | — |
| `PUSH_TOKEN_REGISTERED` | `push.token_registered` | — | Reserved | — |
| `PUSH_NOTIFICATION_TAPPED` | `push.tapped` | — | Reserved | `type` |

---

## Server-side OnboardingEvent funnel backing

These steps are written to the `OnboardingEvent` table by the API regardless of PostHog availability, enabling the `/admin/analytics` funnel to show real numbers:

| Step value | Written when |
|---|---|
| `signup` | New phone user created in `auth.verifyOtp()` |
| `mirror_completed` | `onboarding.submitMirror()` called successfully |
| `mentor_submitted` | `onboarding.submitMentorOnboarding()` called successfully |
| `first_mentor_accepted` | `chatRequests.accept()` called by mentor |
| `paid_activated` | `subscriptions.simulateSuccess()` called (dev) or Razorpay webhook fires (prod) |

---

## Anonymity checklist

All `capture()` calls pass through `apps/web/lib/analytics.ts` / `apps/mobile/lib/analytics.ts`. Neither wrapper sends any data when the PostHog key env var is absent.

Props that may NEVER appear: `phone`, `email`, `displayHandle`, `aadhaar`, `name`, `googleSub`.

Props that are safe: user UUID (only in `identify()`, never in `capture()` props), `role`, `tier`, `category`, `journeyStage`, `journeyType`, `kind`, `mentorId` (UUID only), `step`, `simulated`, `activeCount`, `filter`.
