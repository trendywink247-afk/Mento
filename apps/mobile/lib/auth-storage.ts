import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const ACCESS_KEY = 'mento.access'
const REFRESH_KEY = 'mento.refresh'
const SESSION_KEY = 'mento.session'

const isWeb = Platform.OS === 'web'

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value)
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  }
  return SecureStore.getItemAsync(key)
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key)
    return
  }
  await SecureStore.deleteItemAsync(key)
}

export const authStorage = {
  setAccessToken: (t: string) => setItem(ACCESS_KEY, t),
  getAccessToken: () => getItem(ACCESS_KEY),
  setRefreshToken: (t: string) => setItem(REFRESH_KEY, t),
  getRefreshToken: () => getItem(REFRESH_KEY),
  setSession: (json: string) => setItem(SESSION_KEY, json),
  getSession: () => getItem(SESSION_KEY),
  clear: async () => {
    await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY), deleteItem(SESSION_KEY)])
  },
}
