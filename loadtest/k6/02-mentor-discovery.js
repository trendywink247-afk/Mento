/**
 * loadtest/k6/02-mentor-discovery.js
 *
 * Scenario: GET /mentors with random filters + GET /mentors/:id detail
 *
 * Models authenticated aspirants browsing the mentor discovery list.
 * This is the primary read path after login — typically the first screen an
 * aspirant sees. At 10 M MAU with ~30% daily active aspirants, this endpoint
 * can see ~100k requests/hour at peak (after promotional campaigns).
 *
 * SLO targets:
 *   P95 GET /mentors         < 200 ms
 *   P95 GET /mentors/:id     < 200 ms
 *   Error rate               < 0.1%
 *
 * Load shape:
 *   Ramp 0→150 VUs over 30 s, hold 2 minutes, ramp down 30 s.
 *   This simulates a sustained browse session at the expected peak rate.
 *
 * Prerequisites:
 *   - API running at BASE_URL
 *   - At least a few mentor rows in the DB (or seed data)
 *   - A valid aspirant accessToken exported from SETUP_TOKEN env var, OR
 *     the script creates its own user via the OTP dev flow.
 *
 * Run:
 *   k6 run loadtest/k6/02-mentor-discovery.js
 *   k6 run -e BASE_URL=https://staging.mento.app loadtest/k6/02-mentor-discovery.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'
import { tagParams } from './lib/thresholds.js'
import { authHeaders, randomElement, qs, LANGUAGES, OPTIONAL_SUBJECTS, GUIDANCE_CATEGORIES } from './lib/setup.js'

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const listDuration = new Trend('mentor_list_duration', true)
const detailDuration = new Trend('mentor_detail_duration', true)

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 150 },
    { duration: '120s', target: 150 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{endpoint:mentor_list}': ['p(95)<200'],
    'http_req_duration{endpoint:mentor_detail}': ['p(95)<200'],
    'http_req_failed{endpoint:mentor_list}': ['rate<0.001'],
    'http_req_failed{endpoint:mentor_detail}': ['rate<0.001'],
    // Custom trends
    'mentor_list_duration': ['p(95)<200'],
    'mentor_detail_duration': ['p(95)<200'],
  },
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000'

// A seeded list of mentor UUIDs for detail requests.
// Override with MENTOR_IDS='uuid1,uuid2,...' env var against a real staging DB.
// If empty the script skips detail calls (list-only mode).
const MENTOR_IDS = __ENV.MENTOR_IDS
  ? __ENV.MENTOR_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : []

// ---------------------------------------------------------------------------
// setup() — create one shared aspirant user, reuse token across all VUs.
// ---------------------------------------------------------------------------
export function setup() {
  // If a pre-created token is supplied, skip user creation.
  if (__ENV.SETUP_TOKEN) {
    return { accessToken: __ENV.SETUP_TOKEN }
  }

  // Create a user via dev OTP flow.
  const vu = 0
  const suffix = String((vu * 100000 + Date.now()) % 100000000).padStart(8, '0')
  const phone = `+9174${suffix}`

  const reqRes = http.post(
    `${BASE_URL}/auth/otp/request`,
    JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  if (reqRes.status !== 200) {
    console.error(`[setup] OTP request failed: ${reqRes.status}`)
    return { accessToken: null }
  }

  let devCode
  try { devCode = JSON.parse(reqRes.body).devCode } catch { return { accessToken: null } }

  const verRes = http.post(
    `${BASE_URL}/auth/otp/verify`,
    JSON.stringify({ phone, code: devCode }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  if (verRes.status !== 200) {
    console.error(`[setup] OTP verify failed: ${verRes.status}`)
    return { accessToken: null }
  }

  try {
    const parsed = JSON.parse(verRes.body)
    console.log(`[setup] Created user ${parsed.user.id}, token obtained.`)
    return { accessToken: parsed.tokens.accessToken }
  } catch {
    return { accessToken: null }
  }
}

// ---------------------------------------------------------------------------
// Filter combinations — randomly pick to simulate diverse queries
// Note: URLSearchParams is NOT available in Goja (k6's JS engine). Use the
// qs() helper from lib/setup.js instead.
// ---------------------------------------------------------------------------
function buildFilterQuery() {
  const rates = [500, 800, 1000, 1500, 2000]
  const params = {}

  // 40% chance of each filter being applied
  if (Math.random() < 0.4) params.language = randomElement(LANGUAGES)
  if (Math.random() < 0.3) params.optionalSubject = randomElement(OPTIONAL_SUBJECTS)
  if (Math.random() < 0.3) params.guidanceCategory = randomElement(GUIDANCE_CATEGORIES)
  if (Math.random() < 0.2) params.prelimsCleared = 'true'
  if (Math.random() < 0.2) params.isVerified = 'true'
  if (Math.random() < 0.15) params.maxRateInr = String(randomElement(rates))

  return qs(params)
}

// ---------------------------------------------------------------------------
// VU default function
// ---------------------------------------------------------------------------
export default function (data) {
  if (!data.accessToken) {
    sleep(1)
    return
  }

  const headers = authHeaders(data.accessToken)

  // --- GET /mentors (with random filters) ---
  const filterQuery = buildFilterQuery()
  const listStart = Date.now()
  const listRes = http.get(
    `${BASE_URL}/mentors${filterQuery}`,
    { headers, ...tagParams('mentor_list') },
  )
  listDuration.add(Date.now() - listStart)

  check(listRes, {
    'mentor list: status 200': (r) => r.status === 200,
    'mentor list: is array': (r) => {
      try { return Array.isArray(JSON.parse(r.body)) } catch { return false }
    },
  })

  // --- Optionally fetch one mentor detail ---
  // 60% of browse sessions click through to a detail page.
  if (Math.random() < 0.6) {
    let mentorId = null

    // First try to pick from the list response (most realistic).
    try {
      const mentors = JSON.parse(listRes.body)
      if (Array.isArray(mentors) && mentors.length > 0) {
        mentorId = randomElement(mentors).id ?? randomElement(mentors).userId
      }
    } catch { /* ignore */ }

    // Fall back to seeded IDs if the list was empty or parse failed.
    if (!mentorId && MENTOR_IDS.length > 0) {
      mentorId = randomElement(MENTOR_IDS)
    }

    if (mentorId) {
      sleep(0.3) // simulate reading the list before clicking

      const detailStart = Date.now()
      const detailRes = http.get(
        `${BASE_URL}/mentors/${mentorId}`,
        { headers, ...tagParams('mentor_detail') },
      )
      detailDuration.add(Date.now() - detailStart)

      check(detailRes, {
        'mentor detail: status 200 or 404': (r) => r.status === 200 || r.status === 404,
      })
    }
  }

  // Think time: aspirants read the list, not hammer it continuously.
  sleep(Math.random() * 2 + 0.5) // 0.5–2.5 s
}
