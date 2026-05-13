export const metadata = {
  title: 'Refund Policy — Mento',
  description: 'How refunds work for Mento subscriptions and sessions.',
}

export default function RefundPolicyPage() {
  return (
    <article>
      <h1>Refund Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: 13 May 2026</p>

      <div className="my-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
        <strong>Draft — pending legal review.</strong> Counsel review required
        before paid promotion.
      </div>

      <h2>Subscriptions</h2>
      <p>
        Mento subscriptions (Basic / Pro / Max) renew monthly. You can cancel
        from <a href="/upgrade">/upgrade</a> at any time. Cancellation takes
        effect at the end of the current billing period; the unused portion is
        not pro-rated.
      </p>
      <p>
        First-time subscribers may request a full refund within 7 days of
        signup by emailing <a href="mailto:billing@mento.in">billing@mento.in</a>.
        Refunds typically take 5–7 business days to reach your card or bank
        account.
      </p>

      <h2>1-on-1 sessions</h2>
      <p>
        Until v1.1 ships, all 1-on-1 session bookings are <em>simulated</em> —
        no money changes hands. When real escrow goes live (planned: August
        2026), this section will be updated with the live refund rules
        (mentor-decline auto-refund, mentee-cancel window, no-show policy).
      </p>

      <h2>What is not refundable</h2>
      <ul>
        <li>Subscription days already used.</li>
        <li>Cancellations after the 7-day first-time refund window.</li>
        <li>Accounts terminated for community-guideline violations.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Billing questions: <a href="mailto:billing@mento.in">billing@mento.in</a>.
      </p>
    </article>
  )
}
