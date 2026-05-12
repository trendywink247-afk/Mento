import Link from 'next/link'
import { Check, Minus } from 'lucide-react'

// Spec § 1.12 — pricing tiers. Numbers are placeholders validated in week 2.
const TIERS = [
  {
    id: 'FREE',
    label: 'Free',
    price: '₹0',
    period: 'forever',
    description: 'Start exploring the Mento community',
    cta: 'Get started',
    ctaHref: '/signup',
    highlight: false,
    features: [
      { label: 'Anonymous mentor discovery', included: true },
      { label: '160-char intro chat request', included: true },
      { label: 'Personal journals', included: false },
      { label: 'Open chat after acceptance', included: true },
      { label: 'Broadcast mentor requests', included: false },
      { label: 'Saved chat-to-journal', included: false },
      { label: 'Priority in mentor feed', included: false },
      { label: '1:1 session credits (v1.1)', included: false },
      { label: 'Group session access', included: false },
      { label: 'Verified-mentor priority', included: false },
    ],
  },
  {
    id: 'BASIC',
    label: 'Basic',
    price: '₹399',
    period: '/month',
    description: 'For aspirants getting serious about preparation',
    cta: 'Upgrade to Basic',
    ctaHref: '/upgrade?tier=BASIC',
    highlight: false,
    features: [
      { label: 'Anonymous mentor discovery', included: true },
      { label: '160-char intro chat request', included: true },
      { label: 'Personal journals', included: true },
      { label: 'Open chat after acceptance', included: true },
      { label: 'Broadcast mentor requests', included: false },
      { label: 'Saved chat-to-journal', included: false },
      { label: 'Priority in mentor feed', included: false },
      { label: '1:1 session credits (v1.1)', included: false },
      { label: 'Group session access', included: false },
      { label: 'Verified-mentor priority', included: false },
    ],
  },
  {
    id: 'PRO',
    label: 'Pro',
    price: '₹599',
    period: '/month',
    description: 'For aspirants who want to move faster',
    cta: 'Upgrade to Pro',
    ctaHref: '/upgrade?tier=PRO',
    highlight: true,
    features: [
      { label: 'Anonymous mentor discovery', included: true },
      { label: '160-char intro chat request', included: true },
      { label: 'Personal journals', included: true },
      { label: 'Open chat after acceptance', included: true },
      { label: 'Broadcast mentor requests', included: true },
      { label: 'Saved chat-to-journal', included: true },
      { label: 'Priority in mentor feed', included: true },
      { label: '1:1 session credits (v1.1)', included: false },
      { label: 'Group session access', included: false },
      { label: 'Verified-mentor priority', included: false },
    ],
  },
  {
    id: 'MAX',
    label: 'Max',
    price: '₹999',
    period: '/month',
    description: 'Full access — every feature we ship',
    cta: 'Upgrade to Max',
    ctaHref: '/upgrade?tier=MAX',
    highlight: false,
    features: [
      { label: 'Anonymous mentor discovery', included: true },
      { label: '160-char intro chat request', included: true },
      { label: 'Personal journals', included: true },
      { label: 'Open chat after acceptance', included: true },
      { label: 'Broadcast mentor requests', included: true },
      { label: 'Saved chat-to-journal', included: true },
      { label: 'Priority in mentor feed', included: true },
      { label: '1:1 session credits (v1.1)', included: true },
      { label: 'Group session access', included: true },
      { label: 'Verified-mentor priority', included: true },
    ],
  },
] as const

export const metadata = {
  title: 'Pricing — Mento',
  description:
    'Anonymous UPSC mentorship. Free to start, upgrade when you are ready.',
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Simple, honest pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Start free. Upgrade when the conversation deepens.
          <br />
          We do not rate humans — every rupee goes toward better mentorship infrastructure.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Prices are placeholders and will be validated during user testing in week 2.
        </p>
      </div>

      {/* Tier cards */}
      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={[
              'relative flex flex-col rounded-2xl border p-6',
              tier.highlight
                ? 'border-primary shadow-lg ring-1 ring-primary/20'
                : 'border-border',
            ].join(' ')}
          >
            {tier.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                Most popular
              </span>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold">{tier.label}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{tier.price}</span>
                <span className="text-sm text-muted-foreground">{tier.period}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {tier.features.map((f) => (
                <li key={f.label} className="flex items-start gap-2.5 text-sm">
                  {f.included ? (
                    <Check
                      size={16}
                      className="mt-0.5 shrink-0 text-emerald-500"
                      strokeWidth={2.5}
                    />
                  ) : (
                    <Minus
                      size={16}
                      className="mt-0.5 shrink-0 text-muted-foreground/40"
                      strokeWidth={2}
                    />
                  )}
                  <span
                    className={f.included ? 'text-foreground' : 'text-muted-foreground/60'}
                  >
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.ctaHref}
              className={[
                'block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors',
                tier.highlight
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-foreground hover:bg-accent',
              ].join(' ')}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-12 text-center text-sm text-muted-foreground">
        All plans include anonymity by default. No real names, no photos. Ever.{' '}
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          Sign in
        </Link>{' '}
        to manage your subscription.
      </p>
    </div>
  )
}
