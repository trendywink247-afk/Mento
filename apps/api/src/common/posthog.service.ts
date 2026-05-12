import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog client.
 * No-op when POSTHOG_PROJECT_KEY is not set (e.g. local dev without analytics).
 * Disabled in test environments.
 *
 * NEVER pass PII (phone, email, displayHandle) to capture/identify — user UUID only.
 */
@Injectable()
export class PostHogService implements OnModuleDestroy {
  private client: PostHog | null = null

  constructor() {
    const key = process.env.POSTHOG_PROJECT_KEY
    if (key && process.env.NODE_ENV !== 'test') {
      this.client = new PostHog(key, {
        host: process.env.POSTHOG_HOST ?? 'https://us.posthog.com',
        // Flush at process exit to avoid losing queued events.
        flushAt: 20,
        flushInterval: 10_000,
      })
    }
  }

  /**
   * Track an event.
   * @param distinctId  User UUID or anonymous session ID — no PII.
   * @param event       Event name, e.g. 'onboarding.role_pick'.
   * @param properties  Safe props. Caller must not include phone/email/displayHandle.
   */
  capture(distinctId: string, event: string, properties?: Record<string, unknown>): void {
    if (!this.client) return
    this.client.capture({ distinctId, event, properties: properties ?? {} })
  }

  /**
   * Associate a user UUID with their profile traits.
   * Only safe, non-PII traits (role, etc.) should be passed.
   */
  identify(distinctId: string, properties?: Record<string, string>): void {
    if (!this.client) return
    this.client.identify({ distinctId, properties: properties ?? {} })
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.shutdown()
    }
  }
}
