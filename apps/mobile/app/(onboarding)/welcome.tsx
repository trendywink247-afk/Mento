import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { COPY } from '@/lib/copy'
import { FlashSequence } from '@/components/onboarding/FlashSequence'

const ALL_LINES = [...COPY.welcome, ...COPY.notAPlace, COPY.reflection, COPY.brand]

export default function Welcome() {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => router.replace('/(auth)/login?role=ASPIRANT'), 600)
      return () => clearTimeout(t)
    }
  }, [done])

  return <FlashSequence lines={ALL_LINES} msPerLine={1500} fadeMs={400} onDone={() => setDone(true)} />
}
