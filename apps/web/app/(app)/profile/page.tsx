'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LetterAvatar } from '@/components/LetterAvatar'
import { useAuthStore } from '@/lib/auth-store'
import { getApiClient } from '@/lib/api'

const ROLE_LABEL: Record<string, string> = {
  ASPIRANT: 'Aspirant',
  MENTOR: 'Mentor',
  COORDINATOR: 'Coordinator',
  ADMIN: 'Admin',
}

const TIER_LABEL: Record<string, string> = {
  FREE: 'Free',
  BASIC: 'Basic',
  PRO: 'Pro',
  MAX: 'Max',
}

const TIER_COLOR: Record<string, string> = {
  FREE: 'bg-muted text-muted-foreground',
  BASIC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  PRO: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
  MAX: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, clear } = useAuthStore()
  const [tier, setTier] = useState<string>('FREE')

  useEffect(() => {
    getApiClient()
      .subscriptions.me()
      .then((s) => setTier(s.tier))
      .catch(() => setTier('FREE'))
  }, [])

  function handleLogout() {
    clear()
    router.replace('/login')
  }

  if (!user || !profile) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You are anonymous. Only your display handle and letter avatar are visible to others.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <LetterAvatar
            letter={profile.avatarLetter}
            color={profile.avatarColor}
            hasPurpleTick={profile.hasPurpleTick}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-semibold">{profile.displayHandle}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  TIER_COLOR[tier] ?? TIER_COLOR.FREE
                }`}
              >
                {TIER_LABEL[tier] ?? tier}
              </span>
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-6 text-sm">
          <div>
            <dt className="text-muted-foreground">Joined</dt>
            <dd className="mt-1 font-medium">
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-1 font-medium capitalize">{user.status.toLowerCase()}</dd>
          </div>
          {profile.city && (
            <div>
              <dt className="text-muted-foreground">City</dt>
              <dd className="mt-1 font-medium">{profile.city}</dd>
            </div>
          )}
          {profile.language && (
            <div>
              <dt className="text-muted-foreground">Language</dt>
              <dd className="mt-1 font-medium uppercase">{profile.language}</dd>
            </div>
          )}
        </dl>

        {profile.bio && (
          <div className="mt-6 border-t pt-6 text-sm">
            <div className="text-muted-foreground">Bio</div>
            <p className="mt-1 whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/upgrade"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {tier === 'FREE' ? 'Upgrade plan' : 'Change plan'}
        </Link>
        <button
          onClick={handleLogout}
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
