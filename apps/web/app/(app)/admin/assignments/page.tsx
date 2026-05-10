'use client'

import { useEffect, useState } from 'react'
import { getApiClient } from '@/lib/api'

import type { Role } from '@mento/types'

type UserRow = {
  id: string
  displayHandle: string | null
  phone: string | null
  role: Role
}

export default function AdminAssignmentsPage() {
  const [mentors, setMentors] = useState<UserRow[]>([])
  const [aspirants, setAspirants] = useState<UserRow[]>([])
  const [mentorId, setMentorId] = useState('')
  const [aspirantId, setAspirantId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const c = getApiClient()
    Promise.all([
      c.admin.listUsers({ role: 'MENTOR' }),
      c.admin.listUsers({ role: 'ASPIRANT' }),
    ])
      .then(([m, a]) => {
        setMentors(m)
        setAspirants(a)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load users'),
      )
  }, [])

  async function create() {
    if (!mentorId || !aspirantId) {
      setError('Pick a mentor and an aspirant')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const result = await getApiClient().admin.createAssignment(mentorId, aspirantId)
      setInfo(`Assignment created. Conversation: ${result.conversation.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Pair mentor &amp; aspirant</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Creates an assignment and opens a conversation between them.
      </p>
      <div className="mt-6 grid max-w-xl grid-cols-1 gap-4 rounded-lg border bg-card p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Mentor</label>
          <select
            value={mentorId}
            onChange={(e) => setMentorId(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-2 text-sm"
          >
            <option value="">— select mentor —</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayHandle ?? m.phone ?? m.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Aspirant</label>
          <select
            value={aspirantId}
            onChange={(e) => setAspirantId(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-2 text-sm"
          >
            <option value="">— select aspirant —</option>
            {aspirants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayHandle ?? a.phone ?? a.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-emerald-600">{info}</p>}
        <button
          onClick={create}
          disabled={busy || !mentorId || !aspirantId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create assignment'}
        </button>
      </div>
    </div>
  )
}
