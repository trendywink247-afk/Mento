/**
 * loadtest/k6/03-chat-list-and-history.js
 *
 * Scenario: GET /conversations (cold) → GET /conversations (warm) →
 *           GET /conversations/:id/messages (paginated)
 *
 * Models the read fanout pattern: every time a user opens the chat tab they
 * load the conversation list, then hydrate the most-recent conversation's
 * message history. This is the highest-frequency read path for active users.
 *
 * Cold vs warm split:
 *   First request = no cache (measures DB hit latency).
 *   Second request in same VU iteration = cache warm (connection pool reuse).
 *
 * SLO targets:
 *   P95 GET /conversations              < 300 ms
 *   P95 GET /conversations/:id/messages < 300 ms
 *   Error rate                          < 0.1%
 *
 * Load shape:
 *   Ramp 0→200 VUs over 30 s, hold 2 minutes, ramp down 30 s.
 *   200 VUs × ~1 request/3 s ≈ 67 req/s sustained.
 *   This models ~240k chat-tab opens per hour, typical at peak DAU.
 *
 * Prerequisites:
 *   - API running at BASE_URL
 *   - A valid Bearer token supplied via SETUP_TOKEN env var, OR
 *     the script creates one via the OTP dev flow in setup().
 *   - Optionally: CONV_IDS='uuid1,uuid2,...' to force specific conversation IDs.
 *
 * Run:
 *   k6 run loadtest/k6/03-chat-list-and-history.js
 *   k6 run -e BASE_URL=https://staging.mento.app -e SETUP_TOKEN=eyJ... loadtest/k6/03-chat-list-and-history.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'
import { tagParams } from './lib/thresholds.js'
import { authHeaders, randomElement } from './lib/setup.js'

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const convListDuration = new Trend('conv_list_duration', true)
const convMsgDuration = new Trend('conv_messages_duration', true)

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '120s', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{endpoint:conv_list}': ['p(95)<300'],
    'http_req_duration{endpoint:conv_messages}': ['p(95)<300'],
    'http_req_failed{endpoint:conv_list}': ['rate<0.001'],
    'http_req_failed{endpoint:conv_messages}': ['rate<0.001'],
    'conv_list_duration': ['p(95)<300'],
    'conv_messages_duration': ['p(95)<300'],
  },
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000'

const PRESET_CONV_IDS = __ENV.CONV_IDS
  ? __ENV.CONV_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : []

// Pagination sizes to exercise: simulate both inbox (small) and archive (large) views.
const PAGE_SIZES = [20, 50, 100]

// ---------------------------------------------------------------------------
// setup() — authenticate once, share token across all VUs.
// ---------------------------------------------------------------------------
export function setup() {
  if (__ENV.SETUP_TOKEN) {
    return { accessToken: __ENV.SETUP_TOKEN }
  }

  const suffix = String(Date.now() % 100000000).padStart(8, '0')
  const phone = `+9175${suffix}`

  const reqRes = http.post(
    `${BASE_URL}/auth/otp/request`,
    JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  if (reqRes.status !== 200) {
    console.error(`[setup] OTP request failed: ${reqRes.status} ${reqRes.body}`)
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
    console.error(`[setup] OTP verify failed: ${verRes.status} ${verRes.body}`)
    return { accessToken: null }
  }

  try {
    const parsed = JSON.parse(verRes.body)
    return { accessToken: parsed.tokens.accessToken }
  } catch {
    return { accessToken: null }
  }
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

  // --- Step 1: GET /conversations (cold hit) ---
  const listStart = Date.now()
  const listRes = http.get(
    `${BASE_URL}/conversations`,
    { headers, ...tagParams('conv_list') },
  )
  convListDuration.add(Date.now() - listStart)

  check(listRes, {
    'conv list: status 200': (r) => r.status === 200,
    'conv list: is array': (r) => {
      try { return Array.isArray(JSON.parse(r.body)) } catch { return false }
    },
  })

  // Extract conversation IDs from the list response.
  let conversationIds = [...PRESET_CONV_IDS]
  try {
    const convs = JSON.parse(listRes.body)
    if (Array.isArray(convs)) {
      conversationIds = [
        ...conversationIds,
        ...convs.map((c) => c.id).filter(Boolean),
      ]
    }
  } catch { /* ignore */ }

  // --- Step 2: GET /conversations (warm — immediate repeat simulates tab switch) ---
  sleep(0.1)
  const warmStart = Date.now()
  http.get(
    `${BASE_URL}/conversations`,
    { headers, ...tagParams('conv_list') },
  )
  convListDuration.add(Date.now() - warmStart)

  if (conversationIds.length === 0) {
    // No conversations to browse — new user, just measure list latency.
    sleep(Math.random() * 2 + 0.5)
    return
  }

  // --- Step 3: GET messages for a random conversation ---
  const convId = randomElement(conversationIds)
  const limit = randomElement(PAGE_SIZES)
  sleep(0.2) // simulate tap delay

  const msgStart = Date.now()
  const msgRes = http.get(
    `${BASE_URL}/conversations/${convId}/messages?limit=${limit}`,
    { headers, ...tagParams('conv_messages') },
  )
  convMsgDuration.add(Date.now() - msgStart)

  check(msgRes, {
    'conv messages: 200 or 403': (r) => r.status === 200 || r.status === 403,
    // 403 is acceptable: the shared token may not be a participant of the seeded conv
  })

  // --- Step 4: Paginate backwards (40% of sessions scroll up for history) ---
  if (msgRes.status === 200 && Math.random() < 0.4) {
    let beforeCursor = null
    try {
      const msgs = JSON.parse(msgRes.body)
      if (Array.isArray(msgs) && msgs.length > 0) {
        beforeCursor = msgs[msgs.length - 1].createdAt ?? msgs[msgs.length - 1].id
      }
    } catch { /* ignore */ }

    if (beforeCursor) {
      sleep(0.5)
      const pageStart = Date.now()
      http.get(
        `${BASE_URL}/conversations/${convId}/messages?limit=${limit}&before=${encodeURIComponent(beforeCursor)}`,
        { headers, ...tagParams('conv_messages') },
      )
      convMsgDuration.add(Date.now() - pageStart)
    }
  }

  sleep(Math.random() * 3 + 1) // 1–4 s think time (reading messages)
}
