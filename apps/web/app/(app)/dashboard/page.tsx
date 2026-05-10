'use client'

import { useAuthStore } from '@/lib/auth-store'
import { LetterAvatar } from '@/components/LetterAvatar'

export default function DashboardPage() {
  const { user, profile } = useAuthStore()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your journey is yours alone. Mentors are here when you need a hand.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          {profile && (
            <LetterAvatar
              letter={profile.avatarLetter}
              color={profile.avatarColor}
              hasPurpleTick={profile.hasPurpleTick}
              size={56}
            />
          )}
          <div>
            <p className="text-base font-medium">{profile?.displayHandle ?? '—'}</p>
            <p className="text-xs text-muted-foreground">
              {user?.role} · joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-muted/20 p-6 text-sm text-muted-foreground">
        Your conversations will appear in the Chat tab. The Mirror screen will appear here once
        onboarding lands.
      </div>
    </div>
  )
}
