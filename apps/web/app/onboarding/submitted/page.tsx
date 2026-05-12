'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/auth-store'
import { Submitted } from '@/components/illustrations/Submitted'

export default function MentorSubmittedPage() {
  const router = useRouter()
  const t = useTranslations('onboarding.submitted')
  const tokens = useAuthStore((s) => s.tokens)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  useEffect(() => {
    if (hasHydrated && !tokens) router.replace('/login?role=MENTOR')
  }, [hasHydrated, tokens, router])

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <Submitted className="mx-auto h-44 w-auto" />
        <h1 className="text-2xl font-semibold tracking-tight">{t('heading')}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Our team will review your credentials and verify your account within 1-2 business days.
          You will see your Mentor profile activate and a purple tick appear when verification
          completes.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('honourTime')}
        </p>
        <p className="rounded-md bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          If you have not yet uploaded your verification documents, open Mento on a desktop
          browser to complete that step. Mobile document upload is not supported.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          {t('goToDashboard')}
        </button>
      </div>
    </div>
  )
}
