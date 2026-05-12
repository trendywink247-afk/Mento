import { getTranslations } from 'next-intl/server'

export async function WhatMentoIsNot() {
  const t = await getTranslations('landing.whatIsNot')

  const NOT_LABELS = [
    t('notCoaching'),
    t('notContent'),
    t('notDoubt'),
    t('notTherapy'),
    t('notSocial'),
    t('notLeaderboard'),
  ]

  return (
    <section className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-display-lg font-semibold text-foreground">{t('heading')}</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-muted-foreground">
          {t('subheading')}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {NOT_LABELS.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-5 py-2.5 text-sm font-medium text-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
