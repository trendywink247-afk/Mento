import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

interface HeroProps {
  mentorCount: number
  aspirantCount: number
}

export async function HeroSection({ mentorCount, aspirantCount }: HeroProps) {
  const t = await getTranslations('landing.hero')

  const mentorDisplay = mentorCount > 0 ? mentorCount.toLocaleString('en-IN') : '1,200'
  const aspirantDisplay = aspirantCount > 0 ? aspirantCount.toLocaleString('en-IN') : '8,500'

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Subtle radial overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_20%,hsl(var(--primary)/0.06)_0%,transparent_60%)]"
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 text-center">
        {/* Eyebrow tag */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t('eyebrow')}
        </div>

        {/* Headline */}
        <h1 className="text-display-2xl mx-auto max-w-3xl font-bold text-foreground">
          {t('headline')}
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {t('subheadline')}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/onboarding/role"
            className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t('ctaGetStarted')}
          </Link>
          <a
            href="#how"
            className="inline-flex h-12 items-center rounded-lg border border-border bg-background px-8 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-accent hover:border-border"
          >
            {t('ctaHowItWorks')}
          </a>
        </div>

        {/* Trust strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">{mentorDisplay}</strong>{' '}
            {t('mentorsVerified')}
          </span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" aria-hidden />
          <span>
            <strong className="font-semibold text-foreground">{aspirantDisplay}</strong>{' '}
            {t('aspirantsHelped')}
          </span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" aria-hidden />
          <span>
            <strong className="font-semibold text-foreground">{t('percentAnonymous')}</strong>
          </span>
        </div>
      </div>
    </section>
  )
}
