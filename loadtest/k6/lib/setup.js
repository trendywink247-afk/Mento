/**
 * loadtest/k6/lib/setup.js
 *
 * Shared helpers for Mento k6 load tests.
 *
 * Key public API:
 *   createUser(baseUrl)        → { accessToken, refreshToken, userId, phone }
 *   randomPhone()              → '+91XXXXXXXXXX' — unique per call
 *   authHeaders(accessToken)   → { Authorization: 'Bearer <token>' }
 *   randomElement(array)       → random item
 *   weightedPick(weights)      → index picked by weight
 *
 * OTP flow (dev mode only):
 *   POST /auth/otp/request  → response includes `devCode`
 *   POST /auth/otp/verify   with devCode → returns { tokens, user }
 *
 * IMPORTANT: This only works when NODE_ENV=development on the API (devCode is
 * never included in production responses). Never send real SMS in tests.
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

// ---------------------------------------------------------------------------
// Phone number generation
// ---------------------------------------------------------------------------

/**
 * Generates a random Indian mobile number in E.164 format.
 * Prefixes that don't exist in production (74x) are used to avoid accidental
 * collisions with real numbers.
 * Counters are VU-local — combine with __VU and __ITER for uniqueness.
 *
 * @returns {string} e.g. '+917412345678'
 */
export function randomPhone() {
  // Use VU number + iteration to produce unique phones across all VUs.
  // k6 globals __VU and __ITER are integers injected by the k6 runtime.
  const vu = typeof __VU !== 'undefined' ? __VU : Math.floor(Math.random() * 9000)
  const iter = typeof __ITER !== 'undefined' ? __ITER : Math.floor(Math.random() * 9000)
  // 74 prefix + 8 digits derived from VU/iter combos. Pad to 10 digits.
  const suffix = String((vu * 10000 + iter) % 100000000).padStart(8, '0')
  return `+9174${suffix}`
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Creates a new user via the dev OTP flow and returns credentials.
 * Call this inside a k6 `setup()` function or once per VU in `default`.
 *
 * @param {string} baseUrl - e.g. 'http://localhost:4000'
 * @returns {{ accessToken: string, refreshToken: string, userId: string, phone: string } | null}
 */
export function createUser(baseUrl) {
  const phone = randomPhone()

  // Step 1: request OTP
  const reqRes = http.post(
    `${baseUrl}/auth/otp/request`,
    JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  const reqOk = check(reqRes, {
    'otp/request 200': (r) => r.status === 200,
    'otp/request has devCode': (r) => {
      try {
        return !!JSON.parse(r.body).devCode
      } catch {
        return false
      }
    },
  })

  if (!reqOk) {
    console.error(`[setup] OTP request failed for ${phone}: ${reqRes.status} ${reqRes.body}`)
    return null
  }

  let devCode
  try {
    devCode = JSON.parse(reqRes.body).devCode
  } catch {
    console.error(`[setup] Could not parse devCode for ${phone}`)
    return null
  }

  // Step 2: verify OTP
  const verifyRes = http.post(
    `${baseUrl}/auth/otp/verify`,
    JSON.stringify({ phone, code: devCode }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  const verifyOk = check(verifyRes, {
    'otp/verify 200': (r) => r.status === 200,
    'otp/verify has accessToken': (r) => {
      try {
        return !!JSON.parse(r.body).tokens?.accessToken
      } catch {
        return false
      }
    },
  })

  if (!verifyOk) {
    console.error(`[setup] OTP verify failed for ${phone}: ${verifyRes.status} ${verifyRes.body}`)
    return null
  }

  let parsed
  try {
    parsed = JSON.parse(verifyRes.body)
  } catch {
    console.error(`[setup] Could not parse verify response for ${phone}`)
    return null
  }

  return {
    accessToken: parsed.tokens.accessToken,
    refreshToken: parsed.tokens.refreshToken,
    userId: parsed.user.id,
    phone,
  }
}

/**
 * Creates N users in the k6 setup() phase.
 * Returns an array of credential objects (nulls filtered out).
 *
 * @param {string} baseUrl
 * @param {number} count
 * @returns {Array<{ accessToken: string, refreshToken: string, userId: string, phone: string }>}
 */
export function createUsers(baseUrl, count) {
  const users = []
  for (let i = 0; i < count; i++) {
    const u = createUser(baseUrl)
    if (u) users.push(u)
    // Small pause to stay within Throttler limits during setup
    sleep(0.1)
  }
  console.log(`[setup] Created ${users.length}/${count} users`)
  return users
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/**
 * Returns standard auth headers for a bearer token.
 * @param {string} accessToken
 * @returns {{ Authorization: string, 'Content-Type': string }}
 */
export function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// Random utilities
// ---------------------------------------------------------------------------

/**
 * Returns a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
export function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Weighted random pick. Returns the index of the chosen bucket.
 * weights = [50, 20, 30] → 50% chance of 0, 20% of 1, 30% of 2.
 *
 * @param {number[]} weights - must sum to 100
 * @returns {number} chosen index
 */
export function weightedPick(weights) {
  const r = Math.random() * 100
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]
    if (r < acc) return i
  }
  return weights.length - 1
}

// ---------------------------------------------------------------------------
// Language / filter pools for mentor discovery
// ---------------------------------------------------------------------------

export const LANGUAGES = ['Hindi', 'English', 'Tamil', 'Telugu', 'Malayalam', 'Bengali', 'Marathi']
export const OPTIONAL_SUBJECTS = [
  'History',
  'Geography',
  'Political Science',
  'Sociology',
  'Public Administration',
  'Anthropology',
  'Mathematics',
  'Philosophy',
]
export const GUIDANCE_CATEGORIES = [
  'prelims_strategy',
  'mains_writing',
  'optional_mentoring',
  'interview_prep',
  'study_plan',
]

// ---------------------------------------------------------------------------
// Journal category pool
// ---------------------------------------------------------------------------

export const JOURNAL_CATEGORIES = [
  'PRELIMS',
  'MAINS',
  'OPTIONAL',
  'INTERVIEW',
  'GENERAL',
]

// ---------------------------------------------------------------------------
// Query string builder — Goja (k6's JS engine) does NOT have URLSearchParams.
// Use this instead of `new URLSearchParams()`.
// ---------------------------------------------------------------------------

/**
 * Builds a URL query string from a plain object.
 * Keys with null or undefined values are skipped.
 *
 * @param {Record<string, string | number | boolean | null | undefined>} params
 * @returns {string} e.g. '?foo=bar&baz=qux' or '' if params is empty
 */
export function qs(params) {
  const parts = []
  for (const k in params) {
    if (params[k] === undefined || params[k] === null) continue
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k])))
  }
  return parts.length ? '?' + parts.join('&') : ''
}
