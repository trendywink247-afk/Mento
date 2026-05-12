import { getTranslations } from 'next-intl/server'

export async function FaqSection() {
  const t = await getTranslations('landing.faq')

  const FAQ_ITEMS = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
    { q: t('q5'), a: t('a5') },
    { q: t('q6'), a: t('a6') },
  ]

  return (
    <section className="bg-muted/30 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-display-lg font-semibold text-foreground">
            {t('heading')}
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-border bg-card px-6 py-5 transition-shadow open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                {item.q}
                {/* Chevron indicator */}
                <span className="flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
