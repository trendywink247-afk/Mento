import { create } from 'zustand'
import type { AuthTokens, Profile, User } from '@mento/types'
import { authStorage } from './auth-storage'

interface SessionShape {
  user: User
  profile: Profile | null
  tokens: AuthTokens
}

interface AuthState {
  user: User | null
  profile: Profile | null
  tokens: AuthTokens | null
  hydrated: boolean
  hydrate: () => Promise<void>
  setSession: (s: SessionShape) => Promise<void>
  clear: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  tokens: null,
  hydrated: false,
  hydrate: async () => {
    const raw = await authStorage.getSession()
    if (raw) {
      try {
        const session = JSON.parse(raw) as SessionShape
        set({ user: session.user, profile: session.profile, tokens: session.tokens, hydrated: true })
        return
      } catch {
        await authStorage.clear()
      }
    }
    set({ hydrated: true })
  },
  setSession: async (s) => {
    await authStorage.setSession(JSON.stringify(s))
    await authStorage.setAccessToken(s.tokens.accessToken)
    await authStorage.setRefreshToken(s.tokens.refreshToken)
    set({ user: s.user, profile: s.profile, tokens: s.tokens })
  },
  clear: async () => {
    await authStorage.clear()
    set({ user: null, profile: null, tokens: null })
  },
}))
