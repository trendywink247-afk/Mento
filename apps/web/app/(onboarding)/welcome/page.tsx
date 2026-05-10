'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { COPY } from '@/lib/copy'
import { FlashSequence } from '@/components/onboarding/FlashSequence'

const ALL_LINES = [...COPY.welcome, ...COPY.notAPlace, COPY.reflection, COPY.brand]

export default function WelcomeFlashPage() {
  const router = useRouter()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => router.push('/login?role=ASPIRANT'), 600)
      return () => clearTimeout(t)
    }
  }, [done, router])

  return (
    <FlashSequence
      lines={ALL_LINES}
      msPerLine={1500}
      fadeMs={400}
      onDone={() => setDone(true)}
    />
  )
}
