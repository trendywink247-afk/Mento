// Copy bank — lifted verbatim from the spec where the spec specifies copy.
// Use these strings instead of writing fresh copy. Section refs in comments.

export const COPY = {
  // 1.1 → 1.3 emotional welcome
  welcome: [
    'This is a safe place.',
    'A place for guidance.',
    'A place to be yourself.',
  ],
  // 2.1 → 2.4 what it's NOT
  notAPlace: [
    'Not a place for competition.',
    'Not a classroom.',
    'Not a material exchange.',
    'Not a race.',
  ],
  // Screen 3
  reflection:
    'A place for self-reflection. A place for self-improvement. A place to understand your preparation honestly.',
  // Screen 4
  brand: 'Welcome to Mento.',
  // Screen 5 — auth lead-in
  authLead: [
    'Your details stay safe.',
    'Your personal information will never be shared publicly.',
    'You will interact anonymously within the community.',
    'Your journey is yours alone.',
  ],
  // Mirror intro (screen 6)
  mirrorTitle: 'The Mirror',
  mirrorSubtitle: "Let's understand where you truly are in your journey.",
  // Honest reflection (screen 9)
  honestReflection:
    'Be brutally honest. Grade yourself lower than you think. No one is here to judge you.',
  // Privacy notice (screen 12)
  privacyNotice:
    'Some parts of your prep profile may be shared with mentors to help us match you. Emotional reflections and personal journals stay private.',
  // Mentor philosophy
  mentorPhilosophy:
    'You are one of the valuable assets of this country. You studied hard for years. You carry experience, discipline, and wisdom that many aspirants are searching for.',
  mentorAnonymity:
    'Anonymous mentorship preferred. Avoid sharing personal details. This is built for guidance and meaningful mentorship.',
  mentorSelfProtect:
    'If you are still preparing, protect your own preparation time. Avoid continuous mentoring sessions.',
  // Operating principles
  rateHumans: "We don't appreciate rating humans.",
  honourStruggle: 'We honour the struggle.',
}

export const JOURNEY_STAGES = [
  { value: 'ABOUT_TO_START', label: "I'm about to start preparing" },
  { value: 'ONE_YEAR_IN', label: "I'm one year in" },
  { value: 'TWO_YEARS_IN_NO_PRELIMS', label: "Two+ years in, haven't attempted Prelims" },
  { value: 'ONE_PRELIMS_ATTEMPT', label: 'One Prelims attempt, did not clear' },
  { value: 'MULTI_PRELIMS_NO_CLEAR', label: 'Multiple Prelims attempts, no clear yet' },
  { value: 'PRELIMS_CLEARED', label: 'Cleared Prelims, preparing for Mains' },
  { value: 'MAINS_WRITTEN', label: 'Have written Mains' },
  { value: 'INTERVIEW_ATTEMPTED', label: 'Attended Interview once' },
  { value: 'MULTI_INTERVIEW', label: 'Multiple Interview attempts' },
] as const

export const KNOWLEDGE_SUBJECTS = [
  'Polity',
  'History',
  'Geography',
  'Economy',
  'Environment',
  'Sci-Tech',
  'Ethics',
  'Essay',
  'CSAT',
  'Current Affairs',
  'Newspaper Reading',
] as const

export const CHALLENGE_OPTIONS = [
  'Emotional disturbance',
  'Distraction',
  'Inconsistency',
  'Conceptual gaps',
  'Overthinking',
  'Fear of failure',
  'Information overload',
  'Lack of guidance',
  'Low confidence',
  'Burnout',
  'Recall difficulty',
  'Fact-vs-study confusion',
] as const

export const BACKGROUND_OPTIONS = [
  { value: 'coaching', label: 'Coaching' },
  { value: 'open_source', label: 'Open-source self-study' },
  { value: 'unplanned', label: 'Unplanned / unstructured' },
  { value: 'others', label: 'Other' },
] as const

export const MENTOR_JOURNEY_OPTIONS = [
  { value: 'PRELIMS_CLEARED', label: 'Prelims cleared' },
  { value: 'MAINS_ONCE', label: 'Mains written once' },
  { value: 'MAINS_MULTI', label: 'Mains written multiple times' },
  { value: 'INTERVIEW_ONCE', label: 'Interview attended once' },
  { value: 'INTERVIEW_MULTI', label: 'Multiple Interview attempts' },
  { value: 'STILL_PREPARING', label: 'Still preparing' },
  { value: 'DONE_CLEARED', label: 'Cleared, in service' },
  { value: 'WORKING_AND_PREPARING', label: 'Working + preparing' },
  { value: 'DONE_NOT_PREPARING', label: 'Done with UPSC, not preparing' },
  { value: 'FOUNDING_MENTOR_PARTNER', label: 'Founding mentor partner (long-term Mento partner)' },
] as const

export const GUIDANCE_CATEGORIES = [
  'Foundation',
  'Basic',
  'Prelims',
  'Mains',
  'GS',
  'Ethics',
  'Essay',
  'Optional',
] as const

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'mr', label: 'Marathi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'gu', label: 'Gujarati' },
] as const

// Mentees copy (§ 1.6, § 1.10)
export const MENTEES_COPY = {
  myMenteesEmpty: 'No conversations yet — aspirants you accept will appear here.',
  savedToJournal: (category: string) => `Saved to ${category}.`,
  saveJournalProRequired: 'Saving chat to journal needs PRO.',
} as const

// Journals copy (§ 1.10 + UX audit J5)
export const JOURNALS_COPY = {
  subtitle:
    "Where you write down what you can't tell anyone else. Some pages stay with you. Others, you and your mentor write together.",
  personalQuote:
    'Some pages stay with you. Others, you and your mentor write together.',
  firstEntryPrompt:
    "Your first reflection in this category. There's no template. Write what you can't say out loud.",
  lockedBanner: (handle: string) =>
    `This journal is locked. Your shared history with ${handle} is preserved here.`,
  readOnlyBanner:
    'Both of you must be active in the chat to write here. Currently read-only.',
} as const

// Upgrade / subscription copy (Phase E)
export const UPGRADE_COPY = {
  devModeBanner: 'Dev mode — simulated payment, no card charged.',
  downgrade: 'Downgrade to Free',
  confirmDowngrade:
    "Are you sure? You'll lose access to PRO features at the end of your billing period.",
} as const

// Moderation copy (Phase G)
export const MODERATION_COPY = {
  accountSuspended:
    'This account has been suspended for violating community guidelines. Email support@mento.in to appeal.',
  confirmBan:
    'Banning is permanent — the user and their Aadhaar will be denylisted from re-applying as a mentor.',
} as const

// Auth flow copy (login + OTP)
export const AUTH_COPY = {
  loginLeftPanelQuote: 'We honour the struggle.',
  loginLeftPanelSub: "Anonymous, peer-led UPSC mentorship.\nWalk with someone who's been there.",
  googleComingSoon: 'Coming soon',
  phonePlaceholder: '98765 43210',
  phoneHint: "We'll send a 6-digit code by SMS.",
  phoneError: 'Please enter a 10-digit Indian mobile number.',
  phoneErrorInvalidStart: 'Please enter a valid Indian mobile number (starts with 6–9).',
  termsText: "I agree to Mento's Terms & Privacy",
  trustStrip: '🔒 Anonymous · 🛡 Verified mentors · 🇮🇳 Built in India',
  otpWrongCode: "Code didn't match. Try again.",
  otpResendLabel: 'Resend OTP',
  otpResendCountdown: 'Resend in',
} as const

// Admin analytics dashboard
export const ANALYTICS_COPY = {
  pageTitle: 'Analytics',
  pageSubtitle: 'Founder dashboard — top-line growth, funnel, and moderation health.',
  refresh: 'Refresh',
  generatedAgo: (secs: number) =>
    secs < 60
      ? `Generated ${secs}s ago`
      : `Generated ${Math.floor(secs / 60)}m ago`,
  sections: {
    users: 'Users',
    signups: 'Signups & messages',
    funnel: 'Onboarding funnel',
    subscriptions: 'Subscriptions',
    moderation: 'Moderation health',
    verification: 'Mentor verification',
  },
  cards: {
    totalUsers: 'Total users',
    activeMentors: 'Active mentors',
    paidSubscribers: 'Paid subscribers',
    openReports: 'Open reports',
    mrr: 'MRR (₹)',
  },
  chart: {
    last7d: 'Last 7 days',
    last30d: 'Last 30 days',
    signupsLabel: 'Daily signups',
    messagesLabel: 'Daily messages',
    noData: 'No data yet',
  },
  funnel: {
    signedUp: 'Signed up',
    mirrorComplete: 'Mirror complete',
    mentorAccepted: 'First mentor accepted',
    paidTier: 'Paid tier',
  },
  moderation: {
    open: 'Open reports',
    actions30d: 'Last 30 days',
    warn: 'Warn',
    dismiss: 'Dismiss',
    suspend: 'Suspend',
    ban: 'Ban',
  },
  verification: {
    pending: 'Pending docs',
    approved7d: 'Approved (7d)',
    rejected7d: 'Rejected (7d)',
  },
} as const

// Invite code copy (beta gate)
export const INVITE_COPY = {
  required: 'Mento is currently invite-only. Enter your invite code.',
  invalid: "That invite code isn't valid.",
  expired: 'That invite code has expired or been used.',
  label: 'Invite code',
  placeholder: 'ABCD1234',
  hint: 'Enter your 8-character invite code.',
} as const
