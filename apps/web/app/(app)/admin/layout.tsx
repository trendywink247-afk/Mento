'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [user, router])

  if (!user || user.role !== 'ADMIN') return null
  return <div className="space-y-6">{children}</div>
}
