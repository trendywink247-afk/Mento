import { ApiClient } from '@mento/api-client'
import { useAuthStore } from './auth-store'

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'

let _client: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (_client) return _client
  _client = new ApiClient({
    baseUrl,
    getAccessToken: () => {
      if (typeof window === 'undefined') return null
      return window.localStorage.getItem('mento.access') ?? null
    },
    getRefreshToken: () => {
      if (typeof window === 'undefined') return null
      return useAuthStore.getState().tokens?.refreshToken ?? null
    },
    onTokensRefreshed: (tokens) => {
      if (typeof window === 'undefined') return
      // Replace tokens in localStorage + the in-memory Zustand store. Keep
      // the existing user + profile slices intact.
      const store = useAuthStore.getState()
      if (store.user) {
        store.setSession({ user: store.user, profile: store.profile, tokens })
      } else {
        window.localStorage.setItem('mento.access', tokens.accessToken)
      }
    },
    onUnauthorized: () => {
      if (typeof window === 'undefined') return
      // Refresh failed → clear local session and bounce to /login. The next
      // boundary that reads tokens (app layout effect) will handle redirect.
      useAuthStore.getState().clear()
    },
    onPaymentRequired: (requiredTier, currentTier) => {
      if (typeof window === 'undefined') return
      window.dispatchEvent(
        new CustomEvent('mento:paywall', {
          detail: { requiredTier, currentTier },
        }),
      )
    },
  })
  return _client
}
