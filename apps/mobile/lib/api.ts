import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { ApiClient } from '@mento/api-client'

const baseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.apiUrl ??
  'http://localhost:4000'

let _client: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (_client) return _client
  _client = new ApiClient({
    baseUrl,
    getAccessToken: async () => {
      // SecureStore is unavailable on web; fall back to in-memory/localStorage.
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined') return null
        return window.localStorage.getItem('mento.access')
      }
      return SecureStore.getItemAsync('mento.access')
    },
    onUnauthorized: () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.removeItem('mento.access')
        return
      }
      void SecureStore.deleteItemAsync('mento.access')
    },
  })
  return _client
}
