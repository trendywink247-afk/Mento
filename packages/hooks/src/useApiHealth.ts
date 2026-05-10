import { useEffect, useState } from 'react'
import type { ApiClient } from '@mento/api-client'

export interface ApiHealthState {
  status: 'idle' | 'loading' | 'ok' | 'error'
  uptime?: number
  error?: string
}

export function useApiHealth(client: ApiClient): ApiHealthState {
  const [state, setState] = useState<ApiHealthState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    client
      .health()
      .then((res) => {
        if (cancelled) return
        setState({ status: 'ok', uptime: res.uptime })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [client])

  return state
}
