'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/auth-store'
import { getApiClient } from '@/lib/api'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, tokens, clear } = useAuthStore()

  useEffect(() => {
    if (!tokens) {
      router.replace('/login')
    }
  }, [tokens, router])

  async function handleLogout() {
    if (tokens) {
      await getApiClient().auth.logout(tokens.refreshToken).catch(() => {})
    }
    clear()
    router.replace('/login')
  }

  if (!tokens) return null

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-muted/30 p-4">
        <div className="mb-6">
          <p className="text-lg font-semibold">Mento</p>
          <p className="text-xs text-muted-foreground">{profile?.displayHandle ?? 'Welcome'}</p>
          <p className="text-xs text-muted-foreground">{user?.role}</p>
        </div>
        <nav className="space-y-1 text-sm">
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/chat', label: 'Chat' },
            { href: '/profile', label: 'Profile' },
            ...(user?.role === 'ADMIN' ? [{ href: '/admin', label: 'Admin' }] : []),
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-2 hover:bg-accent ${pathname?.startsWith(link.href) ? 'bg-accent' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="mt-6 w-full rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
