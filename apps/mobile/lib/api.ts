import Constants from 'expo-constants'
import { ApiClient } from '@mento/api-client'
import { authStorage } from './auth-storage'

const baseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.apiUrl ??
  'http://localhost:4000'

let _client: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (_client) return _client
  _client = new ApiClient({
    baseUrl,
    getAccessToken: () => authStorage.getAccessToken(),
    onUnauthorized: () => {
      void authStorage.clear()
    },
  })
  return _client
}
