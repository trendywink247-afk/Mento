'use client'

const KEY = 'mento.session_id'

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = window.localStorage.getItem(KEY)
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
    window.localStorage.setItem(KEY, id)
  }
  return id
}
