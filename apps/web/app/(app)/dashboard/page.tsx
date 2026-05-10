'use client'

import { useAuthStore } from '@/lib/auth-store'

export default function DashboardPage() {
  const { user, profile } = useAuthStore()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to Mento</h1>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="mt-1 font-medium">{profile?.displayName}</p>
        <p className="text-xs text-muted-foreground">
          {user?.phone} · {user?.role}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Phase 2 will replace this with your conversation list.
      </p>
    </div>
  )
}
