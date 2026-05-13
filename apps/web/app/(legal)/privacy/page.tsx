export const metadata = {
  title: 'Privacy Policy — Mento',
  description: 'How Mento collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: 13 May 2026</p>

      <div className="my-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
        <strong>Draft — pending legal review.</strong> This page is a placeholder
        that captures the data-handling commitments made in product. It must be
        reviewed by counsel before paid promotion begins.
      </div>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Phone number</strong>, for OTP-based authentication. Stored
          encrypted. Never shown to other users.
        </li>
        <li>
          <strong>Email</strong>, only if you sign in with Google. Never shown
          to other users.
        </li>
        <li>
          <strong>Mentor verification documents</strong> (Aadhaar
          last-4-and-hash, ID images). Stored encrypted on Cloudflare R2. Hash
          is retained even after account deletion to enforce the mentor
          denylist.
        </li>
        <li>
          <strong>Profile data</strong> you provide during onboarding (year,
          stage, languages, etc.). Used to compute your anonymous display
          handle and letter avatar.
        </li>
        <li>
          <strong>Messages and journal entries</strong> you write inside the
          app. End-to-end ciphering is on the v1.1 roadmap; for MVP, content
          is encrypted at rest but visible to Mento administrators for
          moderation only.
        </li>
        <li>
          <strong>Usage analytics</strong> via PostHog. Autocapture is
          disabled. We track funnel events keyed by your anonymous user UUID
          only — never your phone or email.
        </li>
        <li>
          <strong>Error reports</strong> via Sentry, redacted of PII fields
          (phone, email, Aadhaar) before transmission.
        </li>
      </ul>

      <h2>What we never do</h2>
      <ul>
        <li>Show your phone, email, or real name to other users.</li>
        <li>Sell your data to third parties.</li>
        <li>Store payment card details — Razorpay handles checkout.</li>
        <li>Use third-party advertising trackers.</li>
      </ul>

      <h2>Data retention</h2>
      <p>
        Account data is retained for as long as your account is active. On
        deletion request, we erase personal data within 30 days, with two
        exceptions: (1) the hash of your Aadhaar number (if you applied as a
        mentor and were banned) is retained permanently to prevent
        re-application; (2) anonymized analytics events are kept indefinitely.
      </p>

      <h2>Your rights</h2>
      <p>
        Under Indian data protection norms you can request access, correction,
        or deletion of your data. Email{' '}
        <a href="mailto:privacy@mento.in">privacy@mento.in</a>. We respond
        within 30 days.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or concerns: <a href="mailto:privacy@mento.in">privacy@mento.in</a>.
      </p>
    </article>
  )
}
