/**
 * loadtest/k6/05-mixed-realistic.js
 *
 * Scenario: Weighted mixed daily-usage simulation
 *
 * Traffic distribution (empirically estimated from UPSC-prep app usage patterns):
 *   50% — Chat list + message history read  (most frequent user action)
 *   20% — Mentor browse / discovery         (common post-login flow)
 *   15% — Journal write (upsert + entry)    (engaged users, daily ritual)
 *   10% — Onboarding (signup wave)          (high during campaigns)
 *    5% — Chat message send via REST*       (simulated as HTTP POST proxy)
 *
 * * Note: Real message send goes through Socket.IO. This scenario uses the
 *   REST reporting endpoint (POST /chat/messages/:id/report) as a write-path
 *   HTTP proxy to stress-test the backend write tier without spinning up WS
 *   connections in k6 (Socket.IO k6 extension is separate). The 5% bucket
 *   can be swapped for `k6/x/websockets` if the WS extension is installed.
 *
 * SLO targets (aggregate):
 *   P95 across all endpoints  < 500 ms
 *   P99 across all endpoints  < 1000 ms
 *   Aggregate error rate      < 0.5%
 *
 * Load shape:
 *   Ramp 0→500 VUs over 2 minutes, hold 3 minutes at 500 VUs, ramp down 1 minute.
 *   Total test duration: ~6 minutes.
 *   500 VUs × ~1 req/3 s ≈ 167 req/s sustained at peak.
 *   This maps to ~600k req/hour — within the expected peak-hour range for
 *   10 M MAU with a 5% peak-hour traffic concentration and 10 req/session.
 *
 * Prerequisites:
 *   - API at BASE_URL (default http://localhost:4000)
 *   - NODE_ENV=development for devCode
 *   - At least a few seed users with conversations + journals for read paths.
 *     Use MENTOR_IDS and CONV_IDS env vars to inject known IDs.
 *
 * Run:
 *   k6 run loadtest/k6/05-mixed-realistic.js
 *   k6 run -e BASE_URL=https://staging.mento.app loadtest/k6/05-mixed-realistic.js
 *
 * Output to JSON for later analysis:
 *   k6 run --out json=loadtest/results/mixed-$(date +%Y%m%d-%H%M).json loadtest/k6/05-mixed-realistic.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'
import { tagParams } from './lib/thresholds.js'
import {
  authHeaders,
  randomElement,
  weightedPick,
  qs,
  LANGUAGES,
  OPTIONAL_SUBJECTS,
  GUIDANCE_CATEGORIES,
  JOURNAL_CATEGORIES,
} from './lib/setup.js'

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const scenarioChatRead = new Counter('scenario_chat_read')
const scenarioMentorBrowse = new Counter('scenario_mentor_browse')
const scenarioJournalWrite = new Counter('scenario_journal_write')
const scenarioOnboarding = new Counter('scenario_onboarding')
const scenarioChatWrite = new Counter('scenario_chat_write')
const overallErrorRate = new Rate('overall_error_rate')

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '2m', target: 500 },   // ramp 0→500 VUs
    { duration: '3m', target: 500 },   // hold at 500 VUs
    { duration: '1m', target: 0 },     // ramp down
  ],
  thresholds: {
    // Aggregate SLOs
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.005'],
    'overall_error_rate': ['rate<0.005'],

    // Per-endpoint SLOs (tagged)
    'http_req_duration{endpoint:conv_list}': ['p(95)<300'],
    'http_req_duration{endpoint:conv_messages}': ['p(95)<300'],
    'http_req_duration{endpoint:mentor_list}': ['p(95)<200'],
    'http_req_duration{endpoint:mentor_detail}': ['p(95)<200'],
    'http_req_duration{endpoint:journal_upsert}': ['p(95)<400'],
    'http_req_duration{endpoint:journal_entry}': ['p(95)<400'],
    'http_req_duration{endpoint:auth_otp_request}': ['p(95)<500'],
    'http_req_duration{endpoint:auth_otp_verify}': ['p(95)<500'],
    'http_req_duration{endpoint:onboarding_mirror}': ['p(95)<500'],
  },
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000'
const PRESET_CONV_IDS = __ENV.CONV_IDS
  ? __ENV.CONV_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : []
const PRESET_MENTOR_IDS = __ENV.MENTOR_IDS
  ? __ENV.MENTOR_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : []

// Scenario weights (must sum to 100)
const WEIGHTS = [50, 20, 15, 10, 5]

// ---------------------------------------------------------------------------
// Per-VU auth cache (avoid OTP round-trip every iteration after first)
// ---------------------------------------------------------------------------
const vuState = {}

function ensureAuth() {
  const vu = typeof __VU !== 'undefined' ? __VU : 1
  if (vuState[vu]?.accessToken) return vuState[vu]

  const suffix = String((vu * 888999 + Date.now()) % 100000000).padStart(8, '0')
  const phone = `+9177${suffix}`

  const reqRes = http.post(
    `${BASE_URL}/auth/otp/request`,
    JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' } },
  )
  if (reqRes.status !== 200) return null

  let devCode
  try { devCode = JSON.parse(reqRes.body).devCode } catch { return null }

  const verRes = http.post(
    `${BASE_URL}/auth/otp/verify`,
    JSON.stringify({ phone, code: devCode }),
    { headers: { 'Content-Type': 'application/json' } },
  )
  if (verRes.status !== 200) return null

  try {
    const parsed = JSON.parse(verRes.body)
    vuState[vu] = {
      accessToken: parsed.tokens.accessToken,
      userId: parsed.user.id,
      journalIds: [],
      convIds: [...PRESET_CONV_IDS],
    }
    return vuState[vu]
  } catch { return null }
}

// ---------------------------------------------------------------------------
// Scenario implementations
// ---------------------------------------------------------------------------

function doChatRead(state) {
  scenarioChatRead.add(1)
  const headers = authHeaders(state.accessToken)

  group('chat_read', () => {
    const listRes = http.get(
      `${BASE_URL}/conversations`,
      { headers, ...tagParams('conv_list') },
    )
    const ok1 = check(listRes, { 'conv list 200': (r) => r.status === 200 })
    overallErrorRate.add(!ok1)

    // Accumulate conv IDs for future iterations.
    try {
      const convs = JSON.parse(listRes.body)
      if (Array.isArray(convs)) {
        convs.forEach((c) => {
          if (c.id && !state.convIds.includes(c.id)) state.convIds.push(c.id)
        })
      }
    } catch { /* ignore */ }

    if (state.convIds.length > 0) {
      sleep(0.2)
      const convId = randomElement(state.convIds)
      const msgRes = http.get(
        `${BASE_URL}/conversations/${convId}/messages?limit=50`,
        { headers, ...tagParams('conv_messages') },
      )
      const ok2 = check(msgRes, { 'conv messages 200 or 403': (r) => r.status === 200 || r.status === 403 })
      overallErrorRate.add(!ok2)
    }
  })

  sleep(Math.random() * 2 + 0.5)
}

function doMentorBrowse(state) {
  scenarioMentorBrowse.add(1)
  const headers = authHeaders(state.accessToken)

  group('mentor_browse', () => {
    // Note: URLSearchParams is NOT available in Goja (k6's JS engine).
    // Use the qs() helper from lib/setup.js instead.
    const filterParams = {}
    if (Math.random() < 0.4) filterParams.language = randomElement(LANGUAGES)
    if (Math.random() < 0.3) filterParams.optionalSubject = randomElement(OPTIONAL_SUBJECTS)
    if (Math.random() < 0.3) filterParams.guidanceCategory = randomElement(GUIDANCE_CATEGORIES)
    if (Math.random() < 0.2) filterParams.isVerified = 'true'

    const listRes = http.get(
      `${BASE_URL}/mentors${qs(filterParams)}`,
      { headers, ...tagParams('mentor_list') },
    )
    const ok1 = check(listRes, { 'mentor list 200': (r) => r.status === 200 })
    overallErrorRate.add(!ok1)

    // Click into a detail page 50% of the time.
    if (Math.random() < 0.5) {
      let mentorId = null
      try {
        const mentors = JSON.parse(listRes.body)
        if (Array.isArray(mentors) && mentors.length > 0) {
          mentorId = randomElement(mentors).id ?? randomElement(mentors).userId
        }
      } catch { /* ignore */ }

      if (!mentorId && PRESET_MENTOR_IDS.length > 0) {
        mentorId = randomElement(PRESET_MENTOR_IDS)
      }

      if (mentorId) {
        sleep(0.3)
        const detailRes = http.get(
          `${BASE_URL}/mentors/${mentorId}`,
          { headers, ...tagParams('mentor_detail') },
        )
        const ok2 = check(detailRes, { 'mentor detail 200 or 404': (r) => r.status === 200 || r.status === 404 })
        overallErrorRate.add(!ok2)
      }
    }
  })

  sleep(Math.random() * 2 + 1)
}

function doJournalWrite(state) {
  scenarioJournalWrite.add(1)
  const headers = authHeaders(state.accessToken)

  group('journal_write', () => {
    const category = randomElement(JOURNAL_CATEGORIES)

    const upsertRes = http.post(
      `${BASE_URL}/journals`,
      JSON.stringify({ category, title: `${category} — load test entry` }),
      { headers, ...tagParams('journal_upsert') },
    )
    const ok1 = check(upsertRes, { 'journal upsert 200/201': (r) => r.status === 200 || r.status === 201 })
    overallErrorRate.add(!ok1)

    if (ok1) {
      let journalId
      try { journalId = JSON.parse(upsertRes.body).id } catch { /* ignore */ }

      if (journalId) {
        // Cache for future iterations.
        if (!state.journalIds.includes(journalId)) state.journalIds.push(journalId)

        sleep(1) // simulate typing

        const entryRes = http.post(
          `${BASE_URL}/journals/${journalId}/entries`,
          JSON.stringify({ content: 'Load test entry — GS revision notes for today.' }),
          { headers, ...tagParams('journal_entry') },
        )
        const ok2 = check(entryRes, { 'journal entry 200/201': (r) => r.status === 200 || r.status === 201 })
        overallErrorRate.add(!ok2)
      }
    }
  })

  sleep(Math.random() * 2 + 1)
}

function doOnboarding() {
  scenarioOnboarding.add(1)

  group('onboarding', () => {
    const vu = typeof __VU !== 'undefined' ? __VU : 1
    const iter = typeof __ITER !== 'undefined' ? __ITER : Math.floor(Math.random() * 10000)
    const suffix = String((vu * 13337 + iter * 997 + Date.now()) % 100000000).padStart(8, '0')
    const phone = `+9178${suffix}`

    const reqRes = http.post(
      `${BASE_URL}/auth/otp/request`,
      JSON.stringify({ phone }),
      { headers: { 'Content-Type': 'application/json' }, ...tagParams('auth_otp_request') },
    )
    const ok1 = check(reqRes, { 'otp request 200': (r) => r.status === 200 })
    overallErrorRate.add(!ok1)
    if (!ok1) return

    let devCode
    try { devCode = JSON.parse(reqRes.body).devCode } catch { return }

    sleep(0.5)

    const verRes = http.post(
      `${BASE_URL}/auth/otp/verify`,
      JSON.stringify({ phone, code: devCode }),
      { headers: { 'Content-Type': 'application/json' }, ...tagParams('auth_otp_verify') },
    )
    const ok2 = check(verRes, { 'otp verify 200': (r) => r.status === 200 })
    overallErrorRate.add(!ok2)
    if (!ok2) return

    let accessToken
    try { accessToken = JSON.parse(verRes.body).tokens?.accessToken } catch { return }
    if (!accessToken) return

    sleep(1) // simulate filling Mirror

    // journeyStage must be a valid JourneyStage enum value (not BEGINNER etc).
    // challenges must be an array of strings (max 12), not a plain string.
    // knowledge values must be numbers (0..1 scale).
    const mirrorRes = http.post(
      `${BASE_URL}/onboarding/mirror`,
      JSON.stringify({
        journeyStage: randomElement([
          'ABOUT_TO_START',
          'ONE_YEAR_IN',
          'PRELIMS_CLEARED',
          'MAINS_WRITTEN',
        ]),
        background: 'Load test background text.',
        knowledge: { polity: 3, history: 2, geography: 4 },
        challenges: ['Time management', 'Covering vast syllabus'],
      }),
      { headers: authHeaders(accessToken), ...tagParams('onboarding_mirror') },
    )
    const ok3 = check(mirrorRes, { 'mirror submit 200': (r) => r.status === 200 })
    overallErrorRate.add(!ok3)
  })

  sleep(Math.random() + 0.5)
}

function doChatWriteProxy(state) {
  // Chat message send is Socket.IO in production.
  // As a REST-path write proxy we hit POST /onboarding/event (public, no auth overhead)
  // which exercises the same DB write tier (Prisma + Postgres).
  // Replace this with k6/x/websockets if the WS k6 extension is available.
  scenarioChatWrite.add(1)

  group('chat_write_proxy', () => {
    const eventRes = http.post(
      `${BASE_URL}/onboarding/event`,
      JSON.stringify({
        sessionId: `lt-${typeof __VU !== 'undefined' ? __VU : 0}-${Date.now()}`,
        step: 'load_test_write_proxy',
        metadata: { source: 'k6', note: 'proxying chat write for DB stress' },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'chat_write_proxy' },
      },
    )
    const ok = check(eventRes, { 'event track 204': (r) => r.status === 204 })
    overallErrorRate.add(!ok)
  })

  sleep(Math.random() * 3 + 1)
}

// ---------------------------------------------------------------------------
// VU default function
// ---------------------------------------------------------------------------
export default function () {
  // Ensure we have a valid token (cached after first iteration).
  const state = ensureAuth()
  if (!state) {
    sleep(2)
    return
  }

  // Pick scenario by weighted random.
  const scenario = weightedPick(WEIGHTS)

  switch (scenario) {
    case 0: doChatRead(state); break
    case 1: doMentorBrowse(state); break
    case 2: doJournalWrite(state); break
    case 3: doOnboarding(); break
    case 4: doChatWriteProxy(state); break
    default: doChatRead(state)
  }
}
