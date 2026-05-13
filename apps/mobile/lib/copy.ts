export const COPY = {
  welcome: ['This is a safe place.', 'A place for guidance.', 'A place to be yourself.'],
  notAPlace: [
    'Not a place for competition.',
    'Not a classroom.',
    'Not a material exchange.',
    'Not a race.',
  ],
  reflection:
    'A place for self-reflection. A place for self-improvement. A place to understand your preparation honestly.',
  brand: 'Welcome to Mento.',
  authLead: [
    'Your details stay safe.',
    'Your personal information will never be shared publicly.',
    'You will interact anonymously within the community.',
    'Your journey is yours alone.',
  ],
  mirrorTitle: 'The Mirror',
  mirrorSubtitle: "Let's understand where you truly are in your journey.",
  honestReflection:
    'Be brutally honest. Grade yourself lower than you think. No one is here to judge you.',
  privacyNotice:
    'Some parts of your prep profile may be shared with mentors to help us match you. Emotional reflections and personal journals stay private.',
  mentorPhilosophy:
    'You are one of the valuable assets of this country. You studied hard for years. You carry experience, discipline, and wisdom that many aspirants are searching for.',
  mentorAnonymity:
    'Anonymous mentorship preferred. Avoid sharing personal details. This is built for guidance and meaningful mentorship.',
  mentorSelfProtect:
    'If you are still preparing, protect your own preparation time. Avoid continuous mentoring sessions.',
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
  { value: 'FOUNDING_MENTOR_PARTNER', label: 'Founding mentor partner' },
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

// Chat tab copy
export const CHAT_TABS_COPY = {
  all: 'All',
  pending: 'Pending',
  sent: 'Sent',
  archived: 'Archived',
} as const

export const CHAT_SEARCH_COPY = {
  placeholder: 'Search this conversation',
  empty: 'No matches',
} as const

export const CHAT_ARCHIVE_COPY = {
  toast: 'Conversation archived',
} as const

// Mentees copy (§ 1.6, § 1.10)
export const MENTEES_COPY = {
  myMenteesEmpty: 'No conversations yet — aspirants you accept will appear here.',
  savedToJournal: (category: string) => `Saved to ${category}.`,
  saveJournalProRequired: 'Saving chat to journal needs PRO.',
} as const

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
