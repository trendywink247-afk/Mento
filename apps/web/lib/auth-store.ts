'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthTokens, Profile, User } from '@mento/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  tokens: AuthTokens | null
  setSession: (s: { user: User; profile: Profile | null; tokens: AuthTokens }) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      tokens: null,
      setSession: (s) => {
        set({ user: s.user, profile: s.profile, tokens: s.tokens })
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('mento.access', s.tokens.accessToken)
        }
      },
      clear: () => {
        set({ user: null, profile: null, tokens: null })
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('mento.access')
        }
      },
    }),
    {
      name: 'mento.auth',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : undefined as never)),
    },
  ),
)
