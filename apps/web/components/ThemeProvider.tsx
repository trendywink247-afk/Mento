'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { applyTheme, themeStore } from '@/lib/theme'

/**
 * ThemeProvider — client component that applies the `.dark` class to <html>
 * and keeps it in sync with both localStorage changes and the system
 * prefers-color-scheme media query.
 *
 * Must be rendered inside the React tree early (e.g. inside <Providers>).
 * The actual DOM manipulation happens in useEffect so it doesn't run during SSR.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  )

  // Apply theme on initial mount and whenever preference changes.
  useEffect(() => {
    applyTheme(preference)
  }, [preference])

  // Watch the OS media query when preference is 'system'.
  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [preference])

  return <>{children}</>
}
