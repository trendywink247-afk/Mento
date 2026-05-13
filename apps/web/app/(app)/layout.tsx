'use client'

import { useEffect, useRef, useState } from 'react'
import { FeatureFlagsProvider } from '@/lib/feature-flags'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
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
  Globe,
  Phone,
  Wallet,
  Calendar,
  UserCheck,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/auth-store'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PaywallModal } from '@/components/PaywallModal'
import { LANGUAGE_OPTIONS } from '@/lib/copy'
import { reset as analyticsReset } from '@/lib/analytics'
import * as Sentry from '@sentry/nextjs'

function getPageTitle(pathname: string, titles: Record<string, string>): string {
  for (const [prefix, title] of Object.entries(titles)) {
    if (pathname.startsWith(prefix)) return title
  }
  return 'Mento'
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('nav')
  const tSidebar = useTranslations('sidebar')
  const tCommon = useTranslations('common')
  const { user, profile, tokens, hasHydrated, clear } = useAuthStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [currentTier, setCurrentTier] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hasHydrated && !tokens) router.replace('/login')
  }, [hasHydrated, tokens, router])

  useEffect(() => {
    if (!tokens) return
    getApiClient()
      .subscriptions.me()
      .then((sub) => setCurrentTier(sub.tier))
      .catch(() => setCurrentTier('FREE'))
  }, [tokens])

  // React to tier changes triggered by the upgrade page (dev simulate-success or prod webhook).
  useEffect(() => {
    function handleTierChanged(e: Event) {
      const detail = (e as CustomEvent<{ tier: string }>).detail
      setCurrentTier(detail.tier)
      // Re-fetch from server to ensure accuracy
      getApiClient()
        .subscriptions.me()
        .then((sub) => setCurrentTier(sub.tier))
        .catch(() => {})
    }
    window.addEventListener('mento:tier-changed', handleTierChanged)
    return () => window.removeEventListener('mento:tier-changed', handleTierChanged)
  }, [])

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
        {tSidebar('loadingSession')}
      </div>
    )
  }
  if (!tokens) return null

  const isMentor = user?.role === 'MENTOR'

  const NAV_ITEMS_TRANSLATED = [
    { href: '/dashboard', label: t('dashboard'), Icon: LayoutDashboard },
    { href: '/journals', label: t('journals'), Icon: BookOpen },
    { href: '/chat', label: t('chats'), Icon: MessageSquare },
    { href: '/mentors', label: t('mentors'), Icon: Users },
    { href: '/calls', label: t('calls'), Icon: Phone },
    { href: '/wallet', label: t('wallet'), Icon: Wallet },
    ...(isMentor ? [{ href: '/availability', label: 'Availability', Icon: Calendar }] : []),
    ...(isMentor ? [{ href: '/mentees', label: 'My mentees', Icon: UserCheck }] : []),
    { href: '/profile', label: t('profile'), Icon: User },
  ]

  const PAGE_TITLES_TRANSLATED: Record<string, string> = {
    '/dashboard': t('dashboard'),
    '/journals': t('journals'),
    '/chat': t('chats'),
    '/mentors': t('mentors'),
    '/calls': t('calls'),
    '/wallet': t('wallet'),
    '/availability': 'Availability',
    '/mentees': 'My mentees',
    '/profile': t('profile'),
    '/admin': t('admin'),
  }

  const pageTitle = getPageTitle(pathname ?? '', PAGE_TITLES_TRANSLATED)
  const isAdmin = user?.role === 'ADMIN'

  const navItems = [
    ...NAV_ITEMS_TRANSLATED,
    ...(isAdmin ? [{ href: '/admin', label: t('admin'), Icon: Shield }] : []),
  ]

  return (
    <FeatureFlagsProvider>
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r bg-background">
        {/* Brand block */}
        <div className="flex h-14 items-center border-b px-5">
          <span className="text-lg font-bold tracking-tight text-primary">Mento</span>
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
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                ].join(' ')}
              >
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active-indicator"
                    className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <Icon
                  size={18}
                  className={
                    isActive
                      ? 'text-primary'
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

        {/* Language switcher */}
        <div className="border-t px-3 py-2">
          <LanguageSwitcher label={tSidebar('languageSwitcher')} />
        </div>

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
                {t('profile')}
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
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut size={14} />
                {tCommon('signOut')}
              </button>
            </div>
          )}

          {/* Tier badge sits OUTSIDE the toggle button to avoid nested-interactive violation */}
          {currentTier && (
            <Link
              href="/upgrade"
              tabIndex={-1}
              aria-hidden="true"
              className={[
                'mb-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                currentTier !== 'FREE'
                  ? 'bg-primary/15 text-primary hover:bg-primary/25'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              {currentTier === 'FREE' ? 'Free' : currentTier}
            </Link>
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
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b bg-background px-6">
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
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main id="main" className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>

      {/* Global paywall modal — listens for mento:paywall events from api.ts */}
      <PaywallModal />
    </div>
    </FeatureFlagsProvider>
  )
}

// ---- Language switcher ----

function LanguageSwitcher({ label }: { label: string }) {
  const tCommon = useTranslations('common')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function selectLocale(locale: string) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`
    window.location.reload()
    setOpen(false)
  }

  // Read current locale from cookie
  const currentLocale =
    typeof document !== 'undefined'
      ? document.cookie
          .split('; ')
          .find((c) => c.startsWith('NEXT_LOCALE='))
          ?.split('=')[1] ?? 'en'
      : 'en'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={label}
        aria-expanded={open}
      >
        <Globe size={14} />
        <span>{label}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 overflow-hidden rounded-lg border bg-background shadow-lg">
          {LANGUAGE_OPTIONS.map((lang) => {
            const isActive = lang.value === currentLocale
            const isEnglish = lang.value === 'en'
            return (
              <button
                key={lang.value}
                onClick={() => selectLocale(lang.value)}
                className={[
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-accent',
                ].join(' ')}
              >
                <span>{lang.label}</span>
                {!isEnglish && (
                  <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                    {tCommon('comingSoon')}
                  </span>
                )}
                {isActive && !(!isEnglish) && (
                  <span className="ml-2 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
