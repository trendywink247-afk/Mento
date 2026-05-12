'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Users,
  User,
  Shield,
  Bell,
  Search,
  LogOut,
  Settings,
  HelpCircle,
  ChevronUp,
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { reset as analyticsReset } from '@/lib/analytics'
import * as Sentry from '@sentry/nextjs'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/journals', label: 'Journals', Icon: BookOpen },
  { href: '/chat', label: 'Chats', Icon: MessageSquare },
  { href: '/mentors', label: 'Mentors', Icon: Users },
  { href: '/profile', label: 'Profile', Icon: User },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/journals': 'Journals',
  '/chat': 'Chats',
  '/mentors': 'Mentors',
  '/profile': 'Profile',
  '/admin': 'Admin',
}

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix)) return title
  }
  return 'Mento'
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, tokens, hasHydrated, clear } = useAuthStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hasHydrated && !tokens) router.replace('/login')
  }, [hasHydrated, tokens, router])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  async function handleLogout() {
    setUserMenuOpen(false)
    if (tokens) {
      await getApiClient().auth.logout(tokens.refreshToken).catch(() => {})
    }
    // Reset analytics identity and Sentry user on sign-out.
    analyticsReset()
    if (typeof Sentry.setUser === 'function') {
      Sentry.setUser(null)
    }
    clear()
    router.replace('/login')
  }

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your session&hellip;
      </div>
    )
  }
  if (!tokens) return null

  const pageTitle = getPageTitle(pathname ?? '')
  const isAdmin = user?.role === 'ADMIN'

  const navItems = [
    ...NAV_ITEMS,
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', Icon: Shield }] : []),
  ]

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r bg-background">
        {/* Brand block */}
        <div className="flex h-14 items-center border-b px-5">
          <span className="text-lg font-bold tracking-tight text-blue-600">Mento</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map(({ href, label, Icon }) => {
            const isActive = pathname?.startsWith(href) ?? false
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                ].join(' ')}
              >
                {isActive && (
                  <span className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-blue-600" />
                )}
                <Icon
                  size={18}
                  className={
                    isActive
                      ? 'text-blue-600'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span>{label}</span>
                {href === '/chat' && (
                  <span className="ml-auto inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                    0
                  </span>
                )}
                {href === '/mentors' && (
                  <span
                    className="ml-auto h-2 w-2 rounded-full bg-emerald-500"
                    title="Mentors online"
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User menu at bottom */}
        <div className="border-t p-3" ref={menuRef}>
          {userMenuOpen && (
            <div className="mb-1 overflow-hidden rounded-lg border bg-background shadow-lg">
              <Link
                href="/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent"
              >
                <User size={14} />
                Profile
              </Link>
              <button
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent"
                onClick={() => setUserMenuOpen(false)}
              >
                <Settings size={14} />
                Settings
              </button>
              <button
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent"
                onClick={() => setUserMenuOpen(false)}
              >
                <HelpCircle size={14} />
                Help
              </button>
              <div className="border-t" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}

          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            {profile ? (
              <LetterAvatar
                letter={profile.avatarLetter}
                color={profile.avatarColor}
                hasPurpleTick={profile.hasPurpleTick}
                size={36}
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.displayHandle ?? '—'}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {user?.role?.toLowerCase() ?? ''}
              </p>
            </div>
            <ChevronUp
              size={14}
              className={[
                'text-muted-foreground transition-transform',
                userMenuOpen ? 'rotate-180' : '',
              ].join(' ')}
            />
          </button>
        </div>
      </aside>

      {/* Main content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header bar */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b bg-white px-6">
          <span className="text-sm font-semibold text-foreground">{pageTitle}</span>
          <div className="flex items-center gap-2">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}
