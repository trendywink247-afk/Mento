'use client'

import { useRouter } from 'next/navigation'
import { COPY } from '@/lib/copy'

export default function MentorWelcomePage() {
  const router = useRouter()
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Thank you for being here.</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{COPY.mentorPhilosophy}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{COPY.mentorAnonymity}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{COPY.mentorSelfProtect}</p>
        </div>
        <button
          onClick={() => router.push('/login?role=MENTOR')}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
