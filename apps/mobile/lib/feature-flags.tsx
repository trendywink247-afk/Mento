import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as SecureStore from 'expo-secure-store'
import type { FeatureFlagKey } from '@mento/types'
import { getApiClient } from '@/lib/api'

const STORE_KEY = 'mento.feature_flags'

// ─── Context ──────────────────────────────────────────────────────────────────

interface FeatureFlagsContextValue {
  flags: Record<string, boolean>
  refresh: () => void
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: {},
  refresh: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const isMounted = useRef(true)

  const fetchFlags = useCallback(async () => {
    try {
      const data = await getApiClient().flags.list()
      if (!isMounted.current) return
      setFlags(data)
      // Persist to SecureStore for offline-first behavior.
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(data))
    } catch {
      // Network failure — flags already loaded from SecureStore; no action needed.
    }
  }, [])

  useEffect(() => {
    isMounted.current = true

    // Restore persisted flags immediately so UI doesn't flicker.
    SecureStore.getItemAsync(STORE_KEY)
      .then((raw) => {
        if (raw && isMounted.current) {
          try {
            setFlags(JSON.parse(raw) as Record<string, boolean>)
          } catch {
            // Corrupt store entry — ignore; fetchFlags will overwrite.
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        // Always fetch fresh flags from the server on startup.
        void fetchFlags()
      })

    return () => {
      isMounted.current = false
    }
  }, [fetchFlags])

  return (
    <FeatureFlagsContext.Provider value={{ flags, refresh: () => void fetchFlags() }}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the boolean value of a feature flag.
 * Defaults to false if the flag is absent or not yet loaded.
 */
export function useFeatureFlag(key: FeatureFlagKey | string): boolean {
  const { flags } = useContext(FeatureFlagsContext)
  return flags[key] ?? false
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext)
}
