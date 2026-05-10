'use client'

import { useEffect, useState } from 'react'
import { getApiClient } from '@/lib/api'

type State = { status: 'loading' } | { status: 'ok'; uptime: number } | { status: 'error'; message: string }

export function ApiStatus() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let mounted = true
    getApiClient()
      .health()
      .then((res) => mounted && setState({ status: 'ok', uptime: res.uptime }))
      .catch((err: unknown) =>
        mounted && setState({ status: 'error', message: err instanceof Error ? err.message : String(err) }),
      )
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="rounded-md border bg-muted/40 px-4 py-2 text-sm">
      {state.status === 'loading' && <span>Checking API…</span>}
      {state.status === 'ok' && (
        <span className="text-emerald-600">API ok — uptime {state.uptime}s</span>
      )}
      {state.status === 'error' && (
        <span className="text-red-600">API offline: {state.message}</span>
      )}
    </div>
  )
}
