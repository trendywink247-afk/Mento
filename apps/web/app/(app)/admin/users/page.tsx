'use client'

import { useEffect, useState } from 'react'
import { getApiClient } from '@/lib/api'

type Row = {
  id: string
  phone: string | null
  email: string | null
  role: 'ADMIN' | 'MENTOR' | 'ASPIRANT'
  status: string
  createdAt: string
  displayName: string | null
  mentorVerified: boolean
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      setError(null)
      const data = await getApiClient().admin.listUsers()
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function changeRole(id: string, role: 'ADMIN' | 'MENTOR' | 'ASPIRANT') {
    setBusy(id)
    try {
      await getApiClient().admin.setUserRole(id, role)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setBusy(null)
    }
  }

  async function approveMentor(id: string) {
    setBusy(id)
    try {
      await getApiClient().admin.approveMentor(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows === null ? (
              <tr>
                <td className="px-4 py-3 text-muted-foreground" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-muted-foreground" colSpan={5}>
                  No users yet
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.displayName ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{u.id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.phone ?? u.email ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={busy === u.id}
                      onChange={(e) => changeRole(u.id, e.target.value as Row['role'])}
                      className="rounded-md border bg-background px-2 py-1"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MENTOR">MENTOR</option>
                      <option value="ASPIRANT">ASPIRANT</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs">{u.status}</td>
                  <td className="px-4 py-3 text-right">
                    {u.role === 'MENTOR' && !u.mentorVerified && (
                      <button
                        onClick={() => approveMentor(u.id)}
                        disabled={busy === u.id}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        Verify mentor
                      </button>
                    )}
                    {u.role === 'MENTOR' && u.mentorVerified && (
                      <span className="text-xs text-emerald-600">Verified</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
