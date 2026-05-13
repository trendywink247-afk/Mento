import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export async function LandingFooter() {
  const t = await getTranslations('landing.footer')
  const tb = await getTranslations('brand')

  const FOOTER_COLS = [
    {
      heading: t('product'),
      links: [
        { label: t('mentors'), href: '/onboarding/role' },
        { label: t('pricing'), href: '/onboarding/role' },
        { label: t('forMentors'), href: '/onboarding/role' },
        { label: t('getApp'), href: '/get-app' },
      ],
    },
    {
      heading: t('company'),
      links: [
        { label: t('about'), href: '#' },
        { label: t('press'), href: '#' },
        { label: t('contact'), href: '#' },
      ],
    },
    {
      heading: t('legal'),
      links: [
        { label: t('privacy'), href: '/privacy' },
        { label: t('terms'), href: '/terms' },
        { label: t('refunds'), href: '/refund-policy' },
        { label: t('anonymityPolicy'), href: '/privacy#anonymity' },
      ],
    },
  ]

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 lg:col-span-1">
            <span className="text-lg font-bold tracking-tight text-foreground">{tb('name')}</span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t('tagline')}
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {col.heading}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-8">
          <div className="flex items-center gap-3">
            {/* Wordmark M */}
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
              M
            </span>
            <p className="text-xs text-muted-foreground">{tb('copyright')}</p>
          </div>
          <p className="text-xs text-muted-foreground">{tb('madeInIndia')}</p>
        </div>
      </div>
    </footer>
  )
}
