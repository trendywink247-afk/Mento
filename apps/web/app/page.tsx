import type { Metadata } from 'next'
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

const webBase = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? 'https://agent.agentin.chat'

export const metadata: Metadata = {
  openGraph: {
    title: 'Mento — Anonymous UPSC mentorship',
    description:
      'Walk the UPSC path with someone who has been there. Anonymous, verified peer mentors. No coaching pitch.',
    type: 'website',
    url: webBase,
    images: [{ url: `${webBase}/opengraph-image` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mento — Anonymous UPSC mentorship',
    description:
      'Walk the UPSC path with someone who has been there. Anonymous, verified peer mentors. No coaching pitch.',
    images: [`${webBase}/opengraph-image`],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Mento',
      url: 'https://agent.agentin.chat',
      description:
        'Anonymous, peer-led UPSC mentorship platform. Walk the path with someone who has been there.',
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      name: 'Mento',
      url: 'https://agent.agentin.chat',
      description:
        'Walk the UPSC path with someone who has been there. Anonymous, verified peer mentors.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://agent.agentin.chat/mentors?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingNav />
      <main id="main">
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
