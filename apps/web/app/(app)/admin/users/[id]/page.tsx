'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { ArrowLeft, Loader2 } from 'lucide-react'

type UserDetail = {
  id: string
  phone: string | null
  email: string | null
  role: string
  status: string
  createdAt: string
  bannedAt: string | null
  profile: {
    displayHandle: string
    avatarLetter: string
    avatarColor: string
    hasPurpleTick: boolean
  } | null
  mentorProfile: { isVerified: boolean; journeyType: string } | null
  verification: {
    submittedAt: string
    reviewedAt: string | null
    aadhaarHashSuffix: string | null
    hasAadhaar: boolean
  } | null
  actionHistory: Array<{ id: string; action: string; reason: string; createdAt: string }>
}

const STATUS_OPTIONS = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
  'DELETED',
] as const

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  PENDING_VERIFICATION: 'bg-amber-100 text-amber-800',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  BANNED: 'bg-red-100 text-red-800',
  DELETED: 'bg-slate-100 text-slate-600',
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusChangeTarget, setStatusChangeTarget] = useState<string>('')
  const [statusReason, setStatusReason] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [confirmStatus, setConfirmStatus] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getApiClient().admin.users.get(id)
      setUser(data)
      setStatusChangeTarget(data.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleStatusChange() {
    if (!user || statusChangeTarget === user.status) return
    setStatusBusy(true)
    setStatusError(null)
    try {
      await getApiClient().admin.users.setStatus(id, statusChangeTarget, statusReason || undefined)
      setConfirmStatus(false)
      setStatusReason('')
      await load()
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setStatusBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Loading user...
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? 'User not found'}
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="flex items-start gap-4">
        {user.profile ? (
          <LetterAvatar
            letter={user.profile.avatarLetter as AvatarLetter}
            color={user.profile.avatarColor as AvatarColor}
            hasPurpleTick={user.profile.hasPurpleTick}
            size={48}
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted" />
        )}
        <div>
          <h1 className="text-xl font-semibold">
            {user.profile?.displayHandle ?? '—'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user.id} &middot; {user.role}
          </p>
          <span
            className={[
              'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_BADGE[user.status] ?? 'bg-muted text-muted-foreground',
            ].join(' ')}
          >
            {user.status}
          </span>
        </div>
      </div>

      {/* Contact info — admin only */}
      <div className="mt-6 rounded-lg border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold">Contact (admin-only)</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="font-mono">{user.phone ?? '—'}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-mono">{user.email ?? '—'}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{new Date(user.createdAt).toLocaleString('en-IN')}</dd>
          {user.bannedAt && (
            <>
              <dt className="text-muted-foreground">Banned at</dt>
              <dd className="text-red-700">{new Date(user.bannedAt).toLocaleString('en-IN')}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Verification state */}
      {user.verification && (
        <div className="mt-4 rounded-lg border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold">Verification</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Submitted</dt>
            <dd>{new Date(user.verification.submittedAt).toLocaleString('en-IN')}</dd>
            <dt className="text-muted-foreground">Reviewed</dt>
            <dd>
              {user.verification.reviewedAt
                ? new Date(user.verification.reviewedAt).toLocaleString('en-IN')
                : '—'}
            </dd>
            <dt className="text-muted-foreground">Aadhaar hash suffix</dt>
            <dd className="font-mono">
              {user.verification.aadhaarHashSuffix
                ? `…${user.verification.aadhaarHashSuffix}`
                : '—'}
            </dd>
            <dt className="text-muted-foreground">Has Aadhaar doc</dt>
            <dd>{user.verification.hasAadhaar ? 'Yes' : 'No'}</dd>
          </dl>
        </div>
      )}

      {/* Mentor profile */}
      {user.mentorProfile && (
        <div className="mt-4 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-2">Mentor Profile</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Journey type</dt>
            <dd>{user.mentorProfile.journeyType.replace(/_/g, ' ')}</dd>
            <dt className="text-muted-foreground">Verified</dt>
            <dd>{user.mentorProfile.isVerified ? 'Yes' : 'No'}</dd>
          </dl>
        </div>
      )}

      {/* Status change */}
      {user.status !== 'BANNED' && (
        <div className="mt-4 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Change status</h2>
          <div className="space-y-3">
            <select
              value={statusChangeTarget}
              onChange={(e) => setStatusChangeTarget(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <textarea
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Reason (optional, logged in audit trail)"
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {statusError && (
              <p className="text-sm text-red-700">{statusError}</p>
            )}
            {!confirmStatus ? (
              <button
                onClick={() => setConfirmStatus(true)}
                disabled={statusChangeTarget === user.status}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Apply status change
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmStatus(false)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={statusBusy}
                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {statusBusy ? 'Applying...' : `Confirm: set to ${statusChangeTarget}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action history */}
      {user.actionHistory.length > 0 && (
        <div className="mt-4 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Moderation history</h2>
          <div className="space-y-2">
            {user.actionHistory.map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-mono">
                  {a.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{a.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
