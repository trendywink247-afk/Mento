'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'

export default function MentorSubmittedPage() {
  const router = useRouter()
  const tokens = useAuthStore((s) => s.tokens)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  useEffect(() => {
    if (hasHydrated && !tokens) router.replace('/login?role=MENTOR')
  }, [hasHydrated, tokens, router])

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Thank you.</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Our team will review your details and verify your account within 1-2 business days.
          You will see your Mentor profile activate when verification completes.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We honour the time you've given to this preparation.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  )
}
