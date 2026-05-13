/**
 * Centralized analytics event taxonomy for Mento.
 *
 * Rules:
 * - Every event string is lowercase dot-separated: domain.action
 * - Props MUST NOT include: phone, email, displayHandle, aadhaar, name, googleSub
 * - Allowed identifiers: user UUID (via identify()), role, tier, category, journey stage enum, counts
 * - This file is imported on web; the mobile app has a copy at apps/mobile/lib/events.ts
 */

export const ANALYTICS_EVENTS = {
  // ── Auth funnel ────────────────────────────────────────────────────────────
  AUTH_OTP_REQUESTED:      'auth.otp_requested',
  AUTH_OTP_VERIFIED:       'auth.otp_verified',
  AUTH_GOOGLE_SIGNIN:      'auth.google_signin',
  AUTH_SIGNUP_NEW:         'auth.signup_new',
  AUTH_SIGNUP_RETURNING:   'auth.signup_returning',

  // ── Onboarding funnel — ASPIRANT ────────────────────────────────────────
  ROLE_PICK_VIEWED:           'onboarding.role_pick_viewed',
  ROLE_PICK_SELECTED:         'onboarding.role_pick_selected',   // { role: 'ASPIRANT' | 'MENTOR' }
  WELCOME_FLASH_VIEWED:       'onboarding.welcome_flash_viewed',
  WELCOME_FLASH_COMPLETED:    'onboarding.welcome_flash_completed',
  WELCOME_FLASH_SKIPPED:      'onboarding.welcome_flash_skipped',
  MIRROR_STARTED:             'onboarding.mirror_started',
  MIRROR_STEP_COMPLETED:      'onboarding.mirror_step_completed', // { step: Stage }
  MIRROR_COMPLETED:           'onboarding.mirror_completed',      // { journeyStage }

  // ── Onboarding funnel — MENTOR ──────────────────────────────────────────
  MENTOR_ONBOARDING_STARTED:        'onboarding.mentor_started',
  MENTOR_STEP_COMPLETED:            'onboarding.mentor_step_completed', // { step: Stage }
  MENTOR_HISTORY_ADDED:             'onboarding.mentor_history_added',
  MENTOR_VERIFICATION_SUBMITTED:    'onboarding.mentor_verification_submitted',
  MENTOR_CREDENTIALS_DOC_UPLOADED:  'onboarding.mentor_credentials_uploaded', // { kind }
  MENTOR_VERIFICATION_APPROVED:     'onboarding.mentor_verification_approved',

  // ── Mentor discovery + chat request ────────────────────────────────────
  MENTORS_LIST_VIEWED:      'discovery.list_viewed',
  MENTORS_FILTER_APPLIED:   'discovery.filter_applied',
  MENTOR_PROFILE_VIEWED:    'discovery.profile_viewed',           // { mentorId }
  CHAT_REQUEST_SENT:        'chat.request_sent',                  // { mentorId }
  CHAT_REQUEST_ACCEPTED:    'chat.request_accepted',
  CHAT_REQUEST_DECLINED:    'chat.request_declined',
  CHAT_FIRST_MESSAGE_SENT:  'chat.first_message_sent',

  // ── Chat ────────────────────────────────────────────────────────────────
  MESSAGE_SENT:             'chat.message_sent',
  MESSAGE_REPORTED:         'moderation.message_reported',        // { reason }

  // ── Journals ────────────────────────────────────────────────────────────
  JOURNAL_LIST_VIEWED:      'journal.list_viewed',
  JOURNAL_OPENED:           'journal.opened',                     // { category }
  JOURNAL_ENTRY_CREATED:    'journal.entry_created',              // { category }
  JOURNAL_SHARED_WITH_MENTOR: 'journal.shared',
  CHAT_TO_JOURNAL_SAVED:    'journal.chat_saved',                 // { category }

  // ── Payments funnel ─────────────────────────────────────────────────────
  PRICING_VIEWED:           'payments.pricing_viewed',
  UPGRADE_VIEWED:           'payments.upgrade_viewed',
  UPGRADE_TIER_SELECTED:    'payments.tier_selected',             // { tier }
  CHECKOUT_OPENED:          'payments.checkout_opened',           // { tier }
  SUBSCRIPTION_ACTIVATED:   'payments.subscription_activated',    // { tier, simulated }
  SUBSCRIPTION_CANCELLED:   'payments.subscription_cancelled',
  PAYWALL_SHOWN:            'payments.paywall_shown',             // { requiredTier }

  // ── Sessions (1:1) ───────────────────────────────────────────────────────
  SESSION_REQUEST_SENT:     'session.request_sent',               // { mentorId }
  SESSION_REQUEST_ACCEPTED: 'session.request_accepted',
  SESSION_REQUEST_CANCELLED: 'session.request_cancelled',

  // ── App lifecycle ────────────────────────────────────────────────────────
  APP_OPENED:               'app.opened',
  APP_INSTALLED:            'app.installed',
  PUSH_TOKEN_REGISTERED:    'push.token_registered',
  PUSH_NOTIFICATION_TAPPED: 'push.tapped',                       // { type }
} as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
