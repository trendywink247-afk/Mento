'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FlashSequence } from '@/components/onboarding/FlashSequence'

const INTRO_SEEN_KEY = 'mento.intro_seen'

export default function WelcomeFlashPage() {
  const router = useRouter()
  const t = useTranslations('onboarding.welcome.lines')
  const [ready, setReady] = useState(false)

  // Build flash lines from i18n messages
  const ALL_LINES = [
    t('safe'),
    t('guidance'),
    t('yourself'),
    t('noCompetition'),
    t('noClassroom'),
    t('noMaterial'),
    t('noRace'),
    t('reflection'),
    t('brand'),
  ]

  // Check localStorage on mount. Returning users skip the intro automatically.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const seen = window.localStorage.getItem(INTRO_SEEN_KEY)
      if (seen === 'true') {
        router.replace('/login?role=ASPIRANT')
        return
      }
    }
    setReady(true)
  }, [router])

  function finish() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INTRO_SEEN_KEY, 'true')
    }
    router.push('/login?role=ASPIRANT')
  }

  if (!ready) return null

  return (
    <FlashSequence
      lines={ALL_LINES}
      msPerLine={900}
      fadeMs={300}
      onDone={finish}
      onSkip={finish}
    />
  )
}
