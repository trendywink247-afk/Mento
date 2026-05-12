'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  useEffect(() => {
    if (hasHydrated && user && user.role !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [hasHydrated, user, router])

  if (!hasHydrated) return null
  if (!user || user.role !== 'ADMIN') return null
  return <div className="space-y-6">{children}</div>
}
