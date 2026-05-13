'use client'

import { useState, useEffect, useCallback } from 'react'
import { getApiClient } from '@/lib/api'

type InviteCode = {
  id: string
  code: string
  label: string | null
  maxUses: number
  uses: number
  expiresAt: string | null
  disabledAt: string | null
  createdAt: string
  redemptionCount: number
  status: 'active' | 'disabled' | 'expired' | 'exhausted'
}

function statusBadge(status: InviteCode['status']) {
  const map: Record<InviteCode['status'], string> = {
    active: 'bg-green-100 text-green-800',
    disabled: 'bg-gray-100 text-gray-600',
    expired: 'bg-red-100 text-red-700',
    exhausted: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status]}`}>
      {status}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 text-xs text-primary hover:text-primary/80 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function AdminInvitesPage() {
  const [codes, setCodes] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mint form state
  const [label, setLabel] = useState('')
  const [maxUses, setMaxUses] = useState('1')
  const [expiresDays, setExpiresDays] = useState('')
  const [minting, setMinting] = useState(false)
  const [mintError, setMintError] = useState<string | null>(null)

  const loadCodes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getApiClient().admin.invites.list()
      setCodes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invite codes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadCodes() }, [loadCodes])

  async function handleMint(e: React.FormEvent) {
    e.preventDefault()
    setMinting(true)
    setMintError(null)
    try {
      const body: { label?: string; maxUses?: number; expiresAt?: string } = {}
      if (label.trim()) body.label = label.trim()
      const uses = parseInt(maxUses, 10)
      if (!isNaN(uses) && uses > 0) body.maxUses = uses
      if (expiresDays.trim()) {
        const days = parseInt(expiresDays, 10)
        if (!isNaN(days) && days > 0) {
          const d = new Date()
          d.setDate(d.getDate() + days)
          body.expiresAt = d.toISOString()
        }
      }
      await getApiClient().admin.invites.create(body)
      setLabel('')
      setMaxUses('1')
      setExpiresDays('')
      await loadCodes()
    } catch (err) {
      setMintError(err instanceof Error ? err.message : 'Failed to mint invite code')
    } finally {
      setMinting(false)
    }
  }

  async function handleDisable(id: string) {
    if (!confirm('Disable this invite code? Users with this code will no longer be able to sign up.')) return
    try {
      await getApiClient().admin.invites.disable(id)
      await loadCodes()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to disable invite code')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invite Codes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mint and manage beta invite codes. Codes are only enforced when
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-xs">BETA_INVITE_REQUIRED=true</code>
          is set.
        </p>
      </div>

      {/* Mint form */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold mb-4">Mint new code</h2>
        <form onSubmit={handleMint} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium mb-1">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="twitter-thread-may-2026"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium mb-1">Max uses</label>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium mb-1">Expires in (days)</label>
            <input
              type="number"
              min={1}
              value={expiresDays}
              onChange={(e) => setExpiresDays(e.target.value)}
              placeholder="never"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={minting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {minting ? 'Minting...' : 'Mint code'}
          </button>
        </form>
        {mintError && (
          <p className="mt-2 text-sm text-destructive" role="alert">{mintError}</p>
        )}
      </div>

      {/* Codes table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invite codes yet. Mint one above.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Label</th>
                <th className="px-4 py-3 text-left font-medium">Uses</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {codes.map((c) => (
                <tr key={c.id} className="bg-card hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold tracking-wider">
                    {c.code}
                    <CopyButton text={c.code} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.label ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.uses} / {c.maxUses}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">{statusBadge(c.status)}</td>
                  <td className="px-4 py-3">
                    {c.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleDisable(c.id)}
                        className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                      >
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
