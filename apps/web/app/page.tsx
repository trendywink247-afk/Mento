import { Suspense } from 'react'
import { LandingNav } from '@/components/landing/LandingNav'
import { HeroSection } from '@/components/landing/HeroSection'
import { ManifestoStrip } from '@/components/landing/ManifestoStrip'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { MentorPreviewSection } from '@/components/landing/MentorPreviewSection'
import { MentorPreviewSkeleton } from '@/components/landing/MentorPreviewSkeleton'
import { WhatMentoIsNot } from '@/components/landing/WhatMentoIsNot'
import { FaqSection } from '@/components/landing/FaqSection'
import { FinalCta } from '@/components/landing/FinalCta'
import { LandingFooter } from '@/components/landing/LandingFooter'

async function fetchCounts(): Promise<{ mentors: number; aspirants: number }> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'
    const res = await fetch(`${base}/mentors?isVerified=true`, { next: { revalidate: 300 } })
    if (!res.ok) return { mentors: 0, aspirants: 0 }
    const data = (await res.json()) as unknown[]
    return { mentors: Array.isArray(data) ? data.length : 0, aspirants: 0 }
  } catch {
    return { mentors: 0, aspirants: 0 }
  }
}

export default async function HomePage() {
  const { mentors, aspirants } = await fetchCounts()
  return (
    <>
      <LandingNav />
      <main>
        <HeroSection mentorCount={mentors} aspirantCount={aspirants} />
        <ManifestoStrip />
        <HowItWorks />
        <Suspense fallback={<MentorPreviewSkeleton />}>
          <MentorPreviewSection />
        </Suspense>
        <WhatMentoIsNot />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  )
}
