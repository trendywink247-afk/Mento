import { Compass, Handshake, MapPin } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export async function HowItWorks() {
  const t = await getTranslations('landing.howItWorks')

  const steps = [
    {
      icon: MapPin,
      title: t('step1Title'),
      description: t('step1Desc'),
    },
    {
      icon: Handshake,
      title: t('step2Title'),
      description: t('step2Desc'),
    },
    {
      icon: Compass,
      title: t('step3Title'),
      description: t('step3Desc'),
    },
  ]

  return (
    <section id="how" className="scroll-mt-16 bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-display-lg font-semibold text-foreground">{t('heading')}</h2>
          <p className="mt-3 text-base text-muted-foreground">
            {t('subheading')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div
                key={step.title}
                className="relative rounded-2xl border border-border bg-card p-8 transition-shadow hover:shadow-md"
              >
                {/* Step number */}
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t('stepLabel', { number: idx + 1 })}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
