'use client'

import { createSocketClient, type SocketClient } from '@mento/api-client'

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'

let _socket: SocketClient | null = null

export function getSocket(): SocketClient {
  if (_socket) return _socket
  _socket = createSocketClient({
    baseUrl,
    getAccessToken: () =>
      typeof window !== 'undefined' ? window.localStorage.getItem('mento.access') : null,
  })
  return _socket
}
