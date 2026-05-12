import Link from 'next/link'

interface HeroProps {
  mentorCount: number
  aspirantCount: number
}

export function HeroSection({ mentorCount, aspirantCount }: HeroProps) {
  const mentorDisplay = mentorCount > 0 ? mentorCount.toLocaleString('en-IN') : '1,200'
  const aspirantDisplay = aspirantCount > 0 ? aspirantCount.toLocaleString('en-IN') : '8,500'

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Subtle grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_20%,rgba(37,99,235,0.05)_0%,transparent_60%)]"
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 text-center">
        {/* Eyebrow tag */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-medium text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Anonymous. Peer-led. Human.
        </div>

        {/* Headline */}
        <h1 className="text-display-2xl mx-auto max-w-3xl font-bold text-slate-900">
          Walk the UPSC path with someone who&apos;s been there.
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
          Anonymous, verified peer mentors. No coaching pitch.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/onboarding/role"
            className="inline-flex h-12 items-center rounded-lg bg-blue-600 px-8 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Get started
          </Link>
          <a
            href="#how"
            className="inline-flex h-12 items-center rounded-lg border border-slate-200 bg-white px-8 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
          >
            How it works
          </a>
        </div>

        {/* Trust strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-500">
          <span>
            <strong className="font-semibold text-slate-700">{mentorDisplay}</strong>{' '}
            verified mentors
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden />
          <span>
            <strong className="font-semibold text-slate-700">{aspirantDisplay}</strong>{' '}
            aspirants helped
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden />
          <span>
            <strong className="font-semibold text-slate-700">100% anonymous</strong>
          </span>
        </div>
      </div>
    </section>
  )
}
