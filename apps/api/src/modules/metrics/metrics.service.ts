import { Injectable } from '@nestjs/common'
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client'

/**
 * MetricsService — single Prometheus registry for the Mento API.
 *
 * All custom counters use enumerated label values only.
 * PII (phone, userId, email) MUST NOT appear in label values.
 */
@Injectable()
export class MetricsService {
  readonly register: Registry

  // ── Custom counters ──────────────────────────────────────────────────────

  /** New account creations. method: 'otp' | 'google' */
  readonly signupTotal: Counter<'method'>

  /** Every OTP send request (regardless of success). */
  readonly otpRequestTotal: Counter

  /** OTP verify attempts. outcome: 'ok' | 'wrong' | 'locked' | 'rate_limited' */
  readonly otpVerifyTotal: Counter<'outcome'>

  /** Requests blocked by TierGuard. requiredTier: FREE | BASIC | PRO | MAX */
  readonly paywallTotal: Counter<'requiredTier'>

  /** Subscription lifecycle events. to: 'activated' | 'cancelled' | 'expired'; tier: FREE | BASIC | PRO | MAX */
  readonly subscriptionChangeTotal: Counter<'to' | 'tier'>

  /** Admin moderation decisions. action: 'warn' | 'dismiss' | 'suspend' | 'ban' */
  readonly moderationActionTotal: Counter<'action'>

  /** Chat request lifecycle. outcome: 'sent' | 'accepted' | 'declined' */
  readonly chatRequestTotal: Counter<'outcome'>

  /** Session request lifecycle. outcome: 'sent' | 'accepted' | 'declined' | 'cancelled' */
  readonly sessionRequestTotal: Counter<'outcome'>

  // ── Histograms ───────────────────────────────────────────────────────────

  /** HTTP request duration. Labels: route, status (status code string). */
  readonly httpRequestDuration: Histogram<'route' | 'status'>

  constructor() {
    this.register = new Registry()

    // Standard Node.js metrics (GC, event loop lag, heap, etc.)
    collectDefaultMetrics({ register: this.register })

    this.signupTotal = new Counter({
      name: 'mento_signup_total',
      help: 'Total new user signups',
      labelNames: ['method'],
      registers: [this.register],
    })

    this.otpRequestTotal = new Counter({
      name: 'mento_otp_request_total',
      help: 'Total OTP send requests',
      registers: [this.register],
    })

    this.otpVerifyTotal = new Counter({
      name: 'mento_otp_verify_total',
      help: 'Total OTP verify attempts by outcome',
      labelNames: ['outcome'],
      registers: [this.register],
    })

    this.paywallTotal = new Counter({
      name: 'mento_paywall_total',
      help: 'Requests blocked by subscription tier guard',
      labelNames: ['requiredTier'],
      registers: [this.register],
    })

    this.subscriptionChangeTotal = new Counter({
      name: 'mento_subscription_change_total',
      help: 'Subscription lifecycle changes',
      labelNames: ['to', 'tier'],
      registers: [this.register],
    })

    this.moderationActionTotal = new Counter({
      name: 'mento_moderation_action_total',
      help: 'Admin moderation actions taken',
      labelNames: ['action'],
      registers: [this.register],
    })

    this.chatRequestTotal = new Counter({
      name: 'mento_chat_request_total',
      help: 'Chat request lifecycle events',
      labelNames: ['outcome'],
      registers: [this.register],
    })

    this.sessionRequestTotal = new Counter({
      name: 'mento_session_request_total',
      help: 'Session request lifecycle events',
      labelNames: ['outcome'],
      registers: [this.register],
    })

    this.httpRequestDuration = new Histogram({
      name: 'mento_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.register],
    })
  }
}
