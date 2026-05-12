import Link from 'next/link'
import { MentorPreview } from './MentorPreview'
import { MentorPreviewSkeleton } from './MentorPreviewSkeleton'
import type { AvatarColor, AvatarLetter } from '@mento/types'

interface MentorCard {
  userId: string
  displayHandle: string
  avatarLetter: AvatarLetter
  avatarColor: AvatarColor
  hasPurpleTick: boolean
  prelimsCleared: boolean
  mainsAttempts: number
  interviewAttempts: number
  guidanceCategories: string[]
}

async function fetchMentors(): Promise<MentorCard[]> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'
    const res = await fetch(`${base}/mentors?isVerified=true&limit=6`, {
      next: { revalidate: 300 }, // revalidate every 5 minutes
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data.slice(0, 6) : []
  } catch {
    return []
  }
}

export async function MentorPreviewSection() {
  const mentors = await fetchMentors()
  const isLoaded = true // always show something — skeleton only if array empty

  return (
    <section className="bg-slate-50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-display-lg font-semibold text-slate-900">
              Real mentors who&apos;ve cleared the journey.
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Verified by us. Anonymous to everyone else.
            </p>
          </div>
          <Link
            href="/onboarding/role"
            className="hidden text-sm font-medium text-blue-600 hover:underline lg:block"
          >
            Find your mentor &rarr;
          </Link>
        </div>

        {isLoaded ? (
          <MentorPreview mentors={mentors} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <MentorPreviewSkeleton key={i} />
            ))}
          </div>
        )}

        <div className="mt-8 text-center lg:hidden">
          <Link href="/onboarding/role" className="text-sm font-medium text-blue-600 hover:underline">
            Find your mentor &rarr;
          </Link>
        </div>
      </div>
    </section>
  )
}
