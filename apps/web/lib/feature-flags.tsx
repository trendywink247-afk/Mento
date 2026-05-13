'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { FeatureFlagKey } from '@mento/types'
import { getApiClient } from '@/lib/api'

// ─── Context ──────────────────────────────────────────────────────────────────

interface FeatureFlagsContextValue {
  flags: Record<string, boolean>
  /** Manually trigger a refetch (e.g., after an admin toggle). */
  refresh: () => void
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: {},
  refresh: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

interface FeatureFlagsProviderProps {
  children: React.ReactNode
  /** Pre-fetched flags from the server (SSR). Falls back to client-side fetch. */
  initialFlags?: Record<string, boolean>
  /** Interval in ms to refetch flags. Defaults to 60000 (60s). 0 disables polling. */
  refetchIntervalMs?: number
}

export function FeatureFlagsProvider({
  children,
  initialFlags,
  refetchIntervalMs = 60_000,
}: FeatureFlagsProviderProps) {
  const [flags, setFlags] = useState<Record<string, boolean>>(initialFlags ?? {})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchFlags = useCallback(async () => {
    try {
      const data = await getApiClient().flags.list()
      setFlags(data)
    } catch {
      // Swallow — never block render on flag fetch failure; defaults to false.
    }
  }, [])

  useEffect(() => {
    // Fetch immediately on mount (unless initialFlags were server-provided).
    void fetchFlags()

    if (refetchIntervalMs > 0) {
      timerRef.current = setInterval(() => void fetchFlags(), refetchIntervalMs)
    }

    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
    }
  }, [fetchFlags, refetchIntervalMs])

  return (
    <FeatureFlagsContext.Provider value={{ flags, refresh: () => void fetchFlags() }}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the boolean value of a feature flag.
 * Defaults to false if the flag is absent or flags have not loaded yet.
 *
 * @param key - One of the typed FeatureFlagKey values for compile-time safety.
 */
export function useFeatureFlag(key: FeatureFlagKey | string): boolean {
  const { flags } = useContext(FeatureFlagsContext)
  return flags[key] ?? false
}

/** Returns the raw flags map and a refresh fn. Useful in admin UIs. */
export function useFeatureFlags() {
  return useContext(FeatureFlagsContext)
}
