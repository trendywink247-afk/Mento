'use client'

import { useTranslations } from 'next-intl'
import { MotionFade, MotionStagger, MotionStaggerItem } from '@/components/motion'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth.layout')
  return (
    <main id="main" className="flex min-h-screen bg-muted/30">
      {/* Left panel — visible on md+ only */}
      <div className="hidden md:flex md:flex-1 flex-col justify-center px-16 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-r border-border">
        <div className="max-w-sm">
          <MotionFade delay={0.05}>
            <div className="mb-8">
              <span className="text-2xl font-bold tracking-tight text-foreground">Mento</span>
            </div>
            <h2 className="text-display-lg font-semibold text-foreground leading-tight mb-4">
              {t('honourStruggle').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 ? <br /> : null}</span>
              ))}
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              {t('subline')}
            </p>
          </MotionFade>
          <MotionStagger staggerDelay={0.1} initialDelay={0.2}>
            <MotionStaggerItem>
              <Stat value={t('stat1Value')} label={t('stat1Label')} />
            </MotionStaggerItem>
            <MotionStaggerItem>
              <Stat value={t('stat2Value')} label={t('stat2Label')} />
            </MotionStaggerItem>
            <MotionStaggerItem>
              <Stat value={t('stat3Value')} label={t('stat3Label')} />
            </MotionStaggerItem>
          </MotionStagger>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <MotionFade className="w-full max-w-[440px]" delay={0.1}>
          <div className="rounded-xl border bg-background p-8 shadow-elevated">
            {/* Mobile-only header */}
            <div className="mb-6 text-center md:hidden">
              <h1 className="text-2xl font-semibold tracking-tight">Mento</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('mobileHeader')}</p>
            </div>
            {/* Desktop header — smaller since panel has the big text */}
            <div className="mb-6 hidden md:block">
              <h1 className="text-xl font-semibold tracking-tight">{t('desktopHeader')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('desktopSubheader')}</p>
            </div>
            {children}
          </div>
        </MotionFade>
      </div>
    </main>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="text-lg font-semibold text-primary">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
