import type { Metadata } from 'next'

const base = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? 'https://mento.in'

export const metadata: Metadata = {
  title: 'Terms of Service — Mento',
  description: 'Rules for using the Mento platform.',
  openGraph: {
    title: 'Terms of Service — Mento',
    description: 'Rules for using the Mento platform.',
    type: 'website',
    url: `${base}/terms`,
    images: [{ url: `${base}/privacy/opengraph-image` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service — Mento',
    description: 'Rules for using the Mento platform.',
    images: [`${base}/privacy/opengraph-image`],
  },
}

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: 13 May 2026</p>

      <div className="my-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
        <strong>Draft — pending legal review.</strong> Counsel review required
        before paid promotion.
      </div>

      <h2>Eligibility</h2>
      <p>
        You must be at least 18 years old to use Mento. By signing up you
        confirm that you are a real person and that your verification details
        (where required) are accurate.
      </p>

      <h2>Anonymity</h2>
      <p>
        Mento is anonymous by design. Your display handle is generated; your
        phone, email, and real name are never visible to other users. You agree
        not to reveal another user&apos;s real identity even if you discover it.
      </p>

      <h2>Mentor responsibilities</h2>
      <p>
        Verified mentors who accept aspirants take on a duty of good-faith
        guidance. You may decline any chat or session at any time. You may not
        solicit users for off-platform paid coaching that bypasses Mento.
      </p>

      <h2>Aspirant responsibilities</h2>
      <p>
        Mentors are peers, not certified counselors. Guidance is offered in
        good faith but is not a substitute for professional advice on legal,
        medical, or mental-health matters.
      </p>

      <h2>Prohibited conduct</h2>
      <ul>
        <li>Harassment, slurs, threats, or harmful content.</li>
        <li>Solicitation or commercial spam.</li>
        <li>Sharing another user&apos;s personal details.</li>
        <li>Circumventing the moderation system or anonymity layer.</li>
        <li>Mass automated requests or scraping.</li>
      </ul>
      <p>
        Violations may result in account suspension or a permanent ban with
        Aadhaar denylisting for mentors.
      </p>

      <h2>Subscriptions and refunds</h2>
      <p>
        See our <a href="/refund-policy">refund policy</a>. Subscriptions
        renew monthly until cancelled. Cancellation takes effect at the end
        of the current billing period.
      </p>

      <h2>Disclaimers</h2>
      <p>
        Mento is provided &ldquo;as is&rdquo;. We do not guarantee UPSC
        results. Mentor identities are verified but mentors are not employees
        and their advice is their own.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Material changes will be notified via the
        app at least 14 days before they take effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:hello@mento.in">hello@mento.in</a>.
      </p>
    </article>
  )
}
