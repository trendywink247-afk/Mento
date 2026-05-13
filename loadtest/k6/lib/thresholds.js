/**
 * loadtest/k6/lib/thresholds.js
 *
 * Shared SLO thresholds for all Mento k6 scenarios.
 * Import as:
 *   import { SLO, tags } from './lib/thresholds.js'
 *
 * Values are derived from the 10 M MAU target:
 *   10M MAU / 30 days / 24h = ~13,889 avg req/min baseline
 *   Peak hour factor 5× → ~69,444 req/min → ~1,157 RPS
 *   P95 and error rate budgets are set conservatively for dev/staging;
 *   tighten for production gates once a Grafana SLO dashboard is wired.
 */

// ---------------------------------------------------------------------------
// Per-endpoint SLO definitions
// Used in `thresholds` inside each scenario's `options` block.
// ---------------------------------------------------------------------------
export const SLO = {
  /** OTP request + verify (hot path during paid-promo signup spike) */
  auth: {
    'http_req_duration{endpoint:auth_otp_request}': ['p(95)<500'],
    'http_req_duration{endpoint:auth_otp_verify}': ['p(95)<500'],
    'http_req_failed{endpoint:auth_otp_request}': ['rate<0.001'],
    'http_req_failed{endpoint:auth_otp_verify}': ['rate<0.001'],
  },

  /** GET /mentors (read-heavy discovery browse) */
  mentorDiscovery: {
    'http_req_duration{endpoint:mentor_list}': ['p(95)<200'],
    'http_req_duration{endpoint:mentor_detail}': ['p(95)<200'],
    'http_req_failed{endpoint:mentor_list}': ['rate<0.001'],
    'http_req_failed{endpoint:mentor_detail}': ['rate<0.001'],
  },

  /** GET /conversations + GET /conversations/:id/messages */
  chat: {
    'http_req_duration{endpoint:conv_list}': ['p(95)<300'],
    'http_req_duration{endpoint:conv_messages}': ['p(95)<300'],
    'http_req_failed{endpoint:conv_list}': ['rate<0.001'],
    'http_req_failed{endpoint:conv_messages}': ['rate<0.001'],
  },

  /** POST /journals upsert + POST /journals/:id/entries */
  journal: {
    'http_req_duration{endpoint:journal_upsert}': ['p(95)<400'],
    'http_req_duration{endpoint:journal_entry}': ['p(95)<400'],
    'http_req_failed{endpoint:journal_upsert}': ['rate<0.001'],
    'http_req_failed{endpoint:journal_entry}': ['rate<0.001'],
  },

  /** Mirror submit (hot during onboarding wave) */
  onboarding: {
    'http_req_duration{endpoint:onboarding_mirror}': ['p(95)<500'],
    'http_req_failed{endpoint:onboarding_mirror}': ['rate<0.001'],
  },

  /** Mixed scenario — aggregate across all tagged endpoints */
  mixed: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.005'], // 0.5% aggregate error budget across all routes
  },
}

// ---------------------------------------------------------------------------
// Standard tag factory — add endpoint tag to every request so Grafana panels
// can filter by endpoint without parsing the URL.
// ---------------------------------------------------------------------------

/**
 * Returns a params object with the endpoint tag set.
 * Usage: http.get(url, tagParams('mentor_list'))
 *
 * @param {string} endpointName - snake_case label for this endpoint
 * @returns {object} k6 params object
 */
export function tagParams(endpointName) {
  return { tags: { endpoint: endpointName } }
}
