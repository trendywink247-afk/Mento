import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export async function FinalCta() {
  const t = await getTranslations('landing.finalCta')

  return (
    <section className="bg-background py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <div className="rounded-2xl bg-gradient-to-br from-muted/40 to-primary/10 px-8 py-14 ring-1 ring-border/60">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            {t('eyebrow')}
          </p>
          <h2 className="text-display-lg font-semibold text-foreground">
            {t('heading')}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            {t('subheading')}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/onboarding/role"
              className="inline-flex h-12 items-center rounded-lg bg-primary px-10 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t('cta')}
            </Link>
          </div>

          <p className="mt-8 text-xs text-muted-foreground/60 italic">{t('honourStruggle')}</p>
        </div>
      </div>
    </section>
  )
}
