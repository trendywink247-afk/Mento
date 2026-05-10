import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const KEY = 'mento.session_id'
let cached: string | null = null

export async function getSessionId(): Promise<string> {
  if (cached) return cached
  let existing: string | null = null
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') existing = window.localStorage.getItem(KEY)
  } else {
    existing = await SecureStore.getItemAsync(KEY)
  }
  if (existing) {
    cached = existing
    return existing
  }
  const fresh =
    typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY, fresh)
  } else {
    await SecureStore.setItemAsync(KEY, fresh)
  }
  cached = fresh
  return fresh
}
