/**
 * loadtest/k6/01-onboarding.js
 *
 * Scenario: Sustained OTP Request → OTP Verify → Onboarding State → Mirror Submit
 *
 * Models a paid-promotion signup spike where many new users arrive simultaneously,
 * each going through the full phone-OTP auth + Mirror questionnaire flow.
 *
 * SLO targets:
 *   P95 auth/otp/request  < 500 ms
 *   P95 auth/otp/verify   < 500 ms
 *   P95 onboarding/state  < 300 ms
 *   P95 onboarding/mirror < 500 ms
 *   Error rate            < 0.1% (0.001) per endpoint
 *
 * Load shape:
 *   Ramp 0→50 VUs over 30 s, hold 50 VUs for 90 s, ramp down 30 s.
 *   50 VUs * ~1 signup/8 s ≈ 6 signups/s sustained.
 *   Mirrors a campaign burst of ~21,000 signups/hour without overwhelming dev infra.
 *
 * Prerequisites:
 *   - API running at BASE_URL (default http://localhost:4000)
 *   - NODE_ENV=development on the API so devCode is returned
 *   - No SMS provider needed
 *
 * Run:
 *   k6 run loadtest/k6/01-onboarding.js
 *   k6 run -e BASE_URL=https://staging.mento.app loadtest/k6/01-onboarding.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { tagParams } from './lib/thresholds.js'
import { authHeaders } from './lib/setup.js'

// ---------------------------------------------------------------------------
// Custom metrics (supplement tagged http_req_duration)
// ---------------------------------------------------------------------------
const otpRequestDuration = new Trend('otp_request_duration', true)
const otpVerifyDuration = new Trend('otp_verify_duration', true)
const mirrorDuration = new Trend('mirror_submit_duration', true)
const signupSuccessRate = new Rate('signup_success_rate')

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // ramp up to 50 VUs
    { duration: '90s', target: 50 },  // hold
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    // Per-endpoint SLOs (tagged)
    'http_req_duration{endpoint:auth_otp_request}': ['p(95)<500'],
    'http_req_duration{endpoint:auth_otp_verify}': ['p(95)<500'],
    'http_req_duration{endpoint:onboarding_state}': ['p(95)<300'],
    'http_req_duration{endpoint:onboarding_mirror}': ['p(95)<500'],
    // Error budgets
    'http_req_failed{endpoint:auth_otp_request}': ['rate<0.001'],
    'http_req_failed{endpoint:auth_otp_verify}': ['rate<0.001'],
    'http_req_failed{endpoint:onboarding_mirror}': ['rate<0.001'],
    // Custom
    'signup_success_rate': ['rate>0.99'],
  },
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000'

// Mirror questionnaire payloads — sample a realistic range of answers.
// journeyStage must match the JourneyStage Prisma enum exactly.
// challenges must be string[] (ArrayMaxSize 12) — NOT a plain string.
// knowledge values are numbers (the DTO accepts Record<string, number>).
const MIRROR_PAYLOADS = [
  {
    journeyStage: 'ABOUT_TO_START',
    background: 'Science graduate, started UPSC prep recently.',
    knowledge: { polity: 1, history: 1, geography: 2 },
    challenges: ['Time management', 'Covering the vast syllabus'],
  },
  {
    journeyStage: 'ONE_YEAR_IN',
    background: 'Engineering, 1 year of preparation.',
    knowledge: { polity: 2, history: 2, geography: 3 },
    challenges: ['Answer writing quality', 'GS Paper 4 ethics'],
  },
  {
    journeyStage: 'PRELIMS_CLEARED',
    background: 'Humanities, cleared Prelims, preparing for Mains.',
    knowledge: { polity: 4, history: 3, geography: 4 },
    challenges: ['Mains answer writing', 'Essay quality'],
  },
  {
    journeyStage: 'MAINS_WRITTEN',
    background: 'Commerce graduate, written Mains twice.',
    knowledge: { polity: 4, history: 4, geography: 4 },
    challenges: ['Interview preparation', 'Staying motivated'],
  },
]

// ---------------------------------------------------------------------------
// VU default function
// ---------------------------------------------------------------------------
export default function () {
  // Each VU simulates one full signup per iteration.
  const vu = typeof __VU !== 'undefined' ? __VU : 1
  const iter = typeof __ITER !== 'undefined' ? __ITER : 0
  const suffix = String((vu * 100000 + iter) % 100000000).padStart(8, '0')
  const phone = `+9174${suffix}`

  // --- Step 1: Request OTP ---
  const reqStart = Date.now()
  const reqRes = http.post(
    `${BASE_URL}/auth/otp/request`,
    JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' }, ...tagParams('auth_otp_request') },
  )
  otpRequestDuration.add(Date.now() - reqStart)

  const reqOk = check(reqRes, {
    'otp/request: status 200': (r) => r.status === 200,
    'otp/request: has devCode': (r) => {
      try { return !!JSON.parse(r.body).devCode } catch { return false }
    },
  })

  if (!reqOk) {
    signupSuccessRate.add(false)
    sleep(1)
    return
  }

  let devCode
  try {
    devCode = JSON.parse(reqRes.body).devCode
  } catch {
    signupSuccessRate.add(false)
    return
  }

  sleep(0.5) // simulate user reading SMS / typing code

  // --- Step 2: Verify OTP ---
  const verStart = Date.now()
  const verRes = http.post(
    `${BASE_URL}/auth/otp/verify`,
    JSON.stringify({ phone, code: devCode }),
    { headers: { 'Content-Type': 'application/json' }, ...tagParams('auth_otp_verify') },
  )
  otpVerifyDuration.add(Date.now() - verStart)

  const verOk = check(verRes, {
    'otp/verify: status 200': (r) => r.status === 200,
    'otp/verify: has accessToken': (r) => {
      try { return !!JSON.parse(r.body).tokens?.accessToken } catch { return false }
    },
  })

  if (!verOk) {
    signupSuccessRate.add(false)
    sleep(1)
    return
  }

  let accessToken
  try {
    accessToken = JSON.parse(verRes.body).tokens.accessToken
  } catch {
    signupSuccessRate.add(false)
    return
  }

  sleep(0.3) // simulate client routing to onboarding

  // --- Step 3: Check onboarding state ---
  const stateRes = http.get(
    `${BASE_URL}/onboarding/state`,
    { headers: authHeaders(accessToken), ...tagParams('onboarding_state') },
  )

  check(stateRes, {
    'onboarding/state: status 200': (r) => r.status === 200,
    'onboarding/state: has nextStep': (r) => {
      try { return !!JSON.parse(r.body).nextStep } catch { return false }
    },
  })

  sleep(2) // simulate user filling out Mirror questionnaire (12 screens)

  // --- Step 4: Submit Mirror ---
  const payload = MIRROR_PAYLOADS[Math.floor(Math.random() * MIRROR_PAYLOADS.length)]
  const mirrorStart = Date.now()
  const mirrorRes = http.post(
    `${BASE_URL}/onboarding/mirror`,
    JSON.stringify(payload),
    { headers: authHeaders(accessToken), ...tagParams('onboarding_mirror') },
  )
  mirrorDuration.add(Date.now() - mirrorStart)

  const mirrorOk = check(mirrorRes, {
    'onboarding/mirror: status 200': (r) => r.status === 200,
  })

  signupSuccessRate.add(mirrorOk)

  sleep(1)
}
