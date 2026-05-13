/**
 * loadtest/k6/04-journal-upsert-and-entry.js
 *
 * Scenario: POST /journals (upsert) → POST /journals/:id/entries
 *
 * Models an active aspirant opening their journal, creating or upserting a
 * category journal, then adding a reflective entry after a study session.
 * Also tests GET /journals (list) and GET /journals/:id/audit as reads.
 *
 * SLO targets:
 *   P95 POST /journals                < 400 ms
 *   P95 POST /journals/:id/entries    < 400 ms
 *   P95 GET /journals                 < 200 ms
 *   Error rate                        < 0.1%
 *
 * Load shape:
 *   Ramp 0→80 VUs over 30 s, hold 2 minutes, ramp down 30 s.
 *   Journal writes are less frequent than chat reads; 80 VUs × 1 write/10 s
 *   ≈ 8 writes/s, which covers ~29k journal entries/hour at peak.
 *
 * Prerequisites:
 *   - API running at BASE_URL
 *   - Each VU creates its own user (or reuses SETUP_TOKEN)
 *   - NODE_ENV=development for devCode
 *
 * Run:
 *   k6 run loadtest/k6/04-journal-upsert-and-entry.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { tagParams } from './lib/thresholds.js'
import { authHeaders, randomElement, JOURNAL_CATEGORIES } from './lib/setup.js'

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const journalUpsertDuration = new Trend('journal_upsert_duration', true)
const journalEntryDuration = new Trend('journal_entry_duration', true)
const journalListDuration = new Trend('journal_list_duration', true)
const writeSuccessRate = new Rate('journal_write_success_rate')

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 80 },
    { duration: '120s', target: 80 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{endpoint:journal_list}': ['p(95)<200'],
    'http_req_duration{endpoint:journal_upsert}': ['p(95)<400'],
    'http_req_duration{endpoint:journal_entry}': ['p(95)<400'],
    'http_req_failed{endpoint:journal_list}': ['rate<0.001'],
    'http_req_failed{endpoint:journal_upsert}': ['rate<0.001'],
    'http_req_failed{endpoint:journal_entry}': ['rate<0.001'],
    'journal_write_success_rate': ['rate>0.99'],
  },
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000'

// Sample journal entry content — realistic UPSC study reflections.
const ENTRY_CONTENTS = [
  'Covered Indian Polity chapters 5–8 today. Revised the Fundamental Rights section. Key takeaway: Article 19 has six freedoms, not seven.',
  'Practice essay on "Role of women in UPSC success stories". Used CAF framework. Word count: 1,200. Quality: 7/10 — need better examples.',
  'Attempted 50 Prelims MCQs on Environment & Ecology. Score: 36/50. Weak areas: International conventions and biodiversity hotspots.',
  'GS Paper 2 answer writing — IR topic: India-China border dynamics. Intro struggled; conclusion was strong. Work on answer structure.',
  'Read The Hindu editorial on Supreme Court verdict on electoral bonds. Notes: constitutional provisions, judicial review, Article 19(1)(a).',
  'Completed Yojana special issue on Jal Jeevan Mission. 5 key points noted. Revision plan: revisit in 3 days before mains test series.',
  'Mock interview session with study group. Feedback: speak slower, maintain eye contact, structure DAF-linked answers better.',
]

// ---------------------------------------------------------------------------
// Per-VU auth: each VU creates its own user to avoid read/write races.
// ---------------------------------------------------------------------------
const vuTokenCache = {}

function getOrCreateToken(baseUrl) {
  const vu = typeof __VU !== 'undefined' ? __VU : 1
  if (vuTokenCache[vu]) return vuTokenCache[vu]

  const suffix = String((vu * 777777 + Date.now()) % 100000000).padStart(8, '0')
  const phone = `+9176${suffix}`

  const reqRes = http.post(
    `${baseUrl}/auth/otp/request`,
    JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' } },
  )
  if (reqRes.status !== 200) return null

  let devCode
  try { devCode = JSON.parse(reqRes.body).devCode } catch { return null }

  const verRes = http.post(
    `${baseUrl}/auth/otp/verify`,
    JSON.stringify({ phone, code: devCode }),
    { headers: { 'Content-Type': 'application/json' } },
  )
  if (verRes.status !== 200) return null

  try {
    const parsed = JSON.parse(verRes.body)
    vuTokenCache[vu] = parsed.tokens.accessToken
    return vuTokenCache[vu]
  } catch { return null }
}

// ---------------------------------------------------------------------------
// VU default function
// ---------------------------------------------------------------------------
export default function () {
  // Allow an externally supplied token for simpler staging runs.
  const accessToken = __ENV.SETUP_TOKEN || getOrCreateToken(BASE_URL)

  if (!accessToken) {
    sleep(2)
    return
  }

  const headers = authHeaders(accessToken)

  // --- Step 1: List journals (read — warm path) ---
  const listStart = Date.now()
  const listRes = http.get(
    `${BASE_URL}/journals`,
    { headers, ...tagParams('journal_list') },
  )
  journalListDuration.add(Date.now() - listStart)

  check(listRes, {
    'journal list: status 200': (r) => r.status === 200,
  })

  sleep(0.5) // simulate user navigating to create/open a journal

  // --- Step 2: Upsert a journal ---
  const category = randomElement(JOURNAL_CATEGORIES)
  const upsertPayload = {
    category,
    title: `${category} Journal — ${new Date().toISOString().slice(0, 10)}`,
  }

  const upsertStart = Date.now()
  const upsertRes = http.post(
    `${BASE_URL}/journals`,
    JSON.stringify(upsertPayload),
    { headers, ...tagParams('journal_upsert') },
  )
  journalUpsertDuration.add(Date.now() - upsertStart)

  const upsertOk = check(upsertRes, {
    'journal upsert: status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'journal upsert: has id': (r) => {
      try { return !!JSON.parse(r.body).id } catch { return false }
    },
  })

  if (!upsertOk) {
    writeSuccessRate.add(false)
    sleep(1)
    return
  }

  let journalId
  try {
    journalId = JSON.parse(upsertRes.body).id
  } catch {
    writeSuccessRate.add(false)
    return
  }

  sleep(2) // simulate user typing their journal entry (~30 s for realistic; reduced for test)

  // --- Step 3: Create an entry ---
  const content = randomElement(ENTRY_CONTENTS)
  const entryPayload = {
    type: 'MANUAL_TEXT',
    content,
    // Optional mood tag — 50% chance of including
    ...(Math.random() < 0.5 ? { mood: randomElement(['FOCUSED', 'TIRED', 'MOTIVATED', 'ANXIOUS']) } : {}),
  }

  const entryStart = Date.now()
  const entryRes = http.post(
    `${BASE_URL}/journals/${journalId}/entries`,
    JSON.stringify(entryPayload),
    { headers, ...tagParams('journal_entry') },
  )
  journalEntryDuration.add(Date.now() - entryStart)

  const entryOk = check(entryRes, {
    'journal entry: status 200 or 201': (r) => r.status === 200 || r.status === 201,
  })

  writeSuccessRate.add(entryOk)

  // --- Step 4: Optionally read the audit log (20% of writes) ---
  if (Math.random() < 0.2) {
    sleep(0.3)
    http.get(
      `${BASE_URL}/journals/${journalId}/audit`,
      { headers, tags: { endpoint: 'journal_audit' } },
    )
  }

  sleep(Math.random() * 3 + 1) // 1–4 s before next iteration
}
