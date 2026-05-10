'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { COPY } from '@/lib/copy'
import { getApiClient } from '@/lib/api'
import { getSessionId } from '@/lib/session-id'

export default function RolePickPage() {
  const router = useRouter()
  const [busy, setBusy] = useState<'ASPIRANT' | 'MENTOR' | null>(null)

  async function pick(role: 'ASPIRANT' | 'MENTOR') {
    setBusy(role)
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
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Mento</h1>
          <p className="text-sm text-muted-foreground">{COPY.honourStruggle}</p>
        </div>
        <div className="space-y-3">
          <button
            disabled={busy !== null}
            onClick={() => pick('ASPIRANT')}
            className="w-full rounded-2xl border bg-card p-5 text-left transition-colors hover:bg-accent disabled:opacity-50"
          >
            <p className="text-base font-medium">I'm preparing for UPSC</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Find guidance from someone who's walked your path.
            </p>
          </button>
          <button
            disabled={busy !== null}
            onClick={() => pick('MENTOR')}
            className="w-full rounded-2xl border bg-card p-5 text-left transition-colors hover:bg-accent disabled:opacity-50"
          >
            <p className="text-base font-medium">I'd like to mentor</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You've cleared at least one Prelims. Help someone navigate it.
            </p>
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          You can be both later. Pick what brought you here.
        </p>
      </div>
    </div>
  )
}
