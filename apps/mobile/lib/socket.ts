import Constants from 'expo-constants'
import { createSocketClient, type SocketClient } from '@mento/api-client'
import { authStorage } from './auth-storage'

const baseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.apiUrl ??
  'http://localhost:4000'

let _socket: SocketClient | null = null

export function getSocket(): SocketClient {
  if (_socket) return _socket
  _socket = createSocketClient({
    baseUrl,
    getAccessToken: () => authStorage.getAccessToken(),
  })
  return _socket
}
