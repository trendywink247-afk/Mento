'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, ChevronLeft, Lightbulb } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { getApiClient } from '@/lib/api'
import { getSessionId } from '@/lib/session-id'
import { MotionFade, MotionStagger, MotionStaggerItem, MotionTap } from '@/components/motion'
import { capture } from '@/lib/analytics'

const cardVariants = {
  rest: { y: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  hover: { y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' },
}

const arrowVariants = {
  rest: { opacity: 0, x: -4 },
  hover: { opacity: 1, x: 0 },
}

export default function RolePickPage() {
  const router = useRouter()
  const t = useTranslations('onboarding.role')
  const [busy, setBusy] = useState<'ASPIRANT' | 'MENTOR' | null>(null)

  async function pick(role: 'ASPIRANT' | 'MENTOR') {
    setBusy(role)
    // Fire analytics before the async calls so we capture intent even if API fails.
    capture('onboarding.role_pick', { role })
    try {
      await getApiClient().onboarding.pickRole(getSessionId(), role).catch(() => {})
    } finally {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('mento.role_pick', role)
      }
      router.push(role === 'ASPIRANT' ? '/onboarding/welcome' : '/onboarding/mentor-welcome')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      {/* Back link */}
      <Link
        href="/"
        className="absolute left-6 top-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label="Back to home"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t('heading') === 'Mento' ? 'Back' : 'Back'}
      </Link>

      <div className="w-full max-w-md space-y-8">
        <MotionFade>
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">{t('heading')}</h1>
            <p className="text-sm font-medium italic text-muted-foreground">{t('honourStruggle')}</p>
          </div>
        </MotionFade>

        <MotionStagger staggerDelay={0.08} initialDelay={0.1} className="space-y-3">
          {/* Aspirant card */}
          <MotionStaggerItem>
            <MotionTap disabled={busy !== null}>
              <motion.button
                disabled={busy !== null}
                onClick={() => pick('ASPIRANT')}
                className="w-full rounded-2xl border p-5 text-left disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, rgb(239 246 255) 0%, white 100%)',
                }}
                variants={cardVariants}
                initial="rest"
                whileHover={busy === null ? 'hover' : 'rest'}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon badge */}
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgb(219 234 254)' }}
                  >
                    <BookOpen className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium">{t('aspirantTitle')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('aspirantSub')}
                    </p>
                  </div>

                  {/* Continue arrow — fades in on hover */}
                  <motion.span
                    variants={arrowVariants}
                    transition={{ duration: 0.15 }}
                    className="flex-shrink-0 self-center text-sm text-blue-500"
                    aria-hidden="true"
                  >
                    →
                  </motion.span>
                </div>
              </motion.button>
            </MotionTap>
          </MotionStaggerItem>

          {/* Mentor card */}
          <MotionStaggerItem>
            <MotionTap disabled={busy !== null}>
              <motion.button
                disabled={busy !== null}
                onClick={() => pick('MENTOR')}
                className="w-full rounded-2xl border p-5 text-left disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, rgb(255 251 235) 0%, white 100%)',
                }}
                variants={cardVariants}
                initial="rest"
                whileHover={busy === null ? 'hover' : 'rest'}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon badge */}
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgb(254 243 199)' }}
                  >
                    <Lightbulb className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium">{t('mentorTitle')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('mentorSub')}
                    </p>
                  </div>

                  {/* Continue arrow — fades in on hover */}
                  <motion.span
                    variants={arrowVariants}
                    transition={{ duration: 0.15 }}
                    className="flex-shrink-0 self-center text-sm text-amber-500"
                    aria-hidden="true"
                  >
                    →
                  </motion.span>
                </div>
              </motion.button>
            </MotionTap>
          </MotionStaggerItem>
        </MotionStagger>

        <MotionFade delay={0.3}>
          <p className="text-center text-xs text-muted-foreground">
            {t('bothLater')}
          </p>
        </MotionFade>
      </div>
    </div>
  )
}
