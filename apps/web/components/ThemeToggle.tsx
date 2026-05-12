'use client'

import { useSyncExternalStore } from 'react'
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react'
import { themeStore, nextTheme } from '@/lib/theme'
import type { Theme } from '@/lib/theme'

const LABELS: Record<Theme, string> = {
  light: 'Light theme — click to switch to dark',
  dark: 'Dark theme — click to switch to system',
  system: 'System theme — click to switch to light',
}

const ICONS: Record<Theme, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export function ThemeToggle() {
  const preference = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  )

  const Icon = ICONS[preference]
  const label = LABELS[preference]

  function handleClick() {
    themeStore.set(nextTheme(preference))
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleClick}
      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Icon size={18} aria-hidden />
      <span className="sr-only">{label}</span>
    </button>
  )
}
