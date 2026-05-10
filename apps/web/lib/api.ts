import { ApiClient } from '@mento/api-client'

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'

let _client: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (_client) return _client
  _client = new ApiClient({
    baseUrl,
    getAccessToken: () => {
      // Phase 1: read from auth context / cookie.
      if (typeof window === 'undefined') return null
      return window.localStorage.getItem('mento.access') ?? null
    },
    onUnauthorized: () => {
      if (typeof window === 'undefined') return
      window.localStorage.removeItem('mento.access')
    },
  })
  return _client
}
