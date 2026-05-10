import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@mento/types'

export type SocketClient = Socket<ServerToClientEvents, ClientToServerEvents>

export interface SocketClientOptions {
  baseUrl: string
  getAccessToken: () => string | null | Promise<string | null>
}

export function createSocketClient(opts: SocketClientOptions): SocketClient {
  const socket: SocketClient = io(`${opts.baseUrl}/chat`, {
    autoConnect: false,
    transports: ['websocket'],
    auth: async (cb) => {
      const token = await opts.getAccessToken()
      cb({ token: token ?? '' })
    },
  })
  return socket
}
