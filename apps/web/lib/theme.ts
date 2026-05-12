/**
 * Mento theme utility — no external libraries, no store.
 *
 * Three possible user preferences:
 *   'light'  — always light
 *   'dark'   — always dark
 *   'system' — follow prefers-color-scheme (default)
 *
 * Persisted in localStorage under the key `mento.theme`.
 */

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'mento.theme'

// ─── Persistence ──────────────────────────────────────────────────────────────

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, theme)
}

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve the *effective* theme (always 'light' | 'dark') from a preference.
 * When preference is 'system', reads the OS media query.
 */
export function resolveTheme(preference: Theme): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// ─── DOM application ──────────────────────────────────────────────────────────

export function applyTheme(preference: Theme): void {
  const effective = resolveTheme(preference)
  const html = document.documentElement
  if (effective === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

// ─── Cycling ─────────────────────────────────────────────────────────────────

/** Cycle: light → dark → system → light */
export function nextTheme(current: Theme): Theme {
  if (current === 'light') return 'dark'
  if (current === 'dark') return 'system'
  return 'light'
}

// ─── useSyncExternalStore subscription ───────────────────────────────────────

type Listener = () => void
const listeners = new Set<Listener>()

function emitChange(): void {
  for (const l of listeners) l()
}

export const themeStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot(): Theme {
    return getStoredTheme()
  },

  getServerSnapshot(): Theme {
    // On the server we always return 'system'; the inline script handles flash.
    return 'system'
  },

  set(theme: Theme): void {
    setStoredTheme(theme)
    applyTheme(theme)
    emitChange()
  },
}
