'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { getApiClient } from '@/lib/api'
import { ANALYTICS_COPY } from '@/lib/copy'
import type { AdminAnalyticsSummary } from '@mento/types'

// ─── Indian number formatter ──────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-IN')

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

interface LineChartProps {
  data: number[]
  height?: number
  color?: string
  label?: string
}

function LineChart({ data, height = 64, color = '#7c3aed', label }: LineChartProps) {
  if (!data.length || data.every((v) => v === 0)) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
        aria-label={ANALYTICS_COPY.chart.noData}
      >
        {ANALYTICS_COPY.chart.noData}
      </div>
    )
  }

  const width = 320
  const padX = 4
  const padY = 4
  const maxVal = Math.max(...data, 1)
  const pts = data
    .map((v, i) => {
      const x = padX + (i / (data.length - 1 || 1)) * (width - 2 * padX)
      const y = padY + ((maxVal - v) / maxVal) * (height - 2 * padY)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const fillPts = [
    `${padX},${height}`,
    ...pts.split(' '),
    `${(width - padX).toFixed(1)},${height}`,
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={label ?? 'Line chart'}
    >
      {/* fill */}
      <polygon points={fillPts} fill={color} fillOpacity={0.12} />
      {/* line */}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

interface HBarProps {
  label: string
  value: number
  max: number
  color: string
}

function HBar({ label, value, max, color }: HBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemax={max}
          aria-label={`${label}: ${value}`}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium tabular-nums">{fmt.format(value)}</span>
    </div>
  )
}

// ─── Big number card ──────────────────────────────────────────────────────────

function BigCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">
        {typeof value === 'number' ? fmt.format(value) : value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
}

// ─── Funnel row ───────────────────────────────────────────────────────────────

function FunnelRow({
  label,
  value,
  pct,
  isFirst,
}: {
  label: string
  value: number
  pct: number | null
  isFirst: boolean
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-44 shrink-0">
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex-1">
        <div className="h-6 overflow-hidden rounded bg-muted">
          <div
            className="h-full rounded bg-primary/70 transition-all duration-500"
            style={{ width: isFirst ? '100%' : `${pct ?? 0}%` }}
          />
        </div>
      </div>
      <div className="w-28 shrink-0 text-right tabular-nums text-sm">
        <span className="font-semibold">{fmt.format(value)}</span>
        {!isFirst && pct !== null && (
          <span className="ml-2 text-xs text-muted-foreground">{pct}%</span>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AdminAnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ageSecs, setAgeSecs] = useState(0)
  const [signsView, setSignsView] = useState<'7d' | '30d'>('7d')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getApiClient().admin.analytics.summary()
      setData(result)
      setAgeSecs(0)
    } catch {
      setError('Failed to load analytics. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Tick age counter every second
  useEffect(() => {
    if (!data) return
    const t = setInterval(() => setAgeSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [data])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading analytics…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => void load()}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  // Derived values
  const paidCount = data.subscriptions.basic + data.subscriptions.pro + data.subscriptions.max
  const totalUsersBase = data.users.total || 1
  const mirrorCount = Math.round((data.onboarding.mirrorCompletionRate / 100) * (data.users.byRole.ASPIRANT || 0))
  const mentorAcceptedCount = Math.round((data.onboarding.mentorApprovalRate / 100) * (data.users.byRole.MENTOR || 0))

  const chartData = signsView === '7d' ? data.signups.last7d : data.signups.last30d

  const subMax = Math.max(
    data.subscriptions.free,
    data.subscriptions.basic,
    data.subscriptions.pro,
    data.subscriptions.max,
    1,
  )

  const modMax = Math.max(
    data.moderation.last30dActions.WARN,
    data.moderation.last30dActions.DISMISS,
    data.moderation.last30dActions.SUSPEND,
    data.moderation.last30dActions.BAN,
    1,
  )

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ANALYTICS_COPY.pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ANALYTICS_COPY.pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {ANALYTICS_COPY.generatedAgo(ageSecs)}
          </span>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {ANALYTICS_COPY.refresh}
          </button>
        </div>
      </div>

      {/* Section 1 — Big number cards */}
      <section aria-labelledby="section-users">
        <SectionHeader title={ANALYTICS_COPY.sections.users} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <BigCard label={ANALYTICS_COPY.cards.totalUsers} value={data.users.total} />
          <BigCard
            label={ANALYTICS_COPY.cards.activeMentors}
            value={data.users.byRole.MENTOR}
            sub={`${data.users.byStatus.ACTIVE} active`}
          />
          <BigCard
            label={ANALYTICS_COPY.cards.paidSubscribers}
            value={paidCount}
            sub={`${data.subscriptions.max} MAX`}
          />
          <BigCard
            label={ANALYTICS_COPY.cards.openReports}
            value={data.moderation.openReports}
          />
          <BigCard
            label={ANALYTICS_COPY.cards.mrr}
            value={`₹${fmt.format(data.subscriptions.mrrInr)}`}
            sub="BASIC×399 + PRO×599 + MAX×999"
          />
        </div>

        {/* By-role + by-status breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              By role
            </p>
            <div className="space-y-2">
              {(
                [
                  ['ASPIRANT', '#3b82f6'],
                  ['MENTOR', '#8b5cf6'],
                  ['COORDINATOR', '#10b981'],
                  ['ADMIN', '#f59e0b'],
                ] as [keyof typeof data.users.byRole, string][]
              ).map(([role, color]) => (
                <HBar
                  key={role}
                  label={role.charAt(0) + role.slice(1).toLowerCase()}
                  value={data.users.byRole[role]}
                  max={totalUsersBase}
                  color={color}
                />
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              By status
            </p>
            <div className="space-y-2">
              {(
                [
                  ['ACTIVE', '#10b981'],
                  ['PENDING_VERIFICATION', '#f59e0b'],
                  ['SUSPENDED', '#ef4444'],
                  ['BANNED', '#991b1b'],
                ] as [keyof typeof data.users.byStatus, string][]
              ).map(([status, color]) => (
                <HBar
                  key={status}
                  label={status === 'PENDING_VERIFICATION' ? 'Pending' : status.charAt(0) + status.slice(1).toLowerCase()}
                  value={data.users.byStatus[status]}
                  max={totalUsersBase}
                  color={color}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — Signups chart */}
      <section aria-labelledby="section-signups">
        <div className="mb-4 flex items-center justify-between">
          <SectionHeader title={ANALYTICS_COPY.sections.signups} />
          <div className="flex rounded-md border text-xs">
            <button
              onClick={() => setSignsView('7d')}
              className={[
                'px-3 py-1.5 rounded-l-md transition-colors',
                signsView === '7d'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-muted-foreground',
              ].join(' ')}
            >
              {ANALYTICS_COPY.chart.last7d}
            </button>
            <button
              onClick={() => setSignsView('30d')}
              className={[
                'px-3 py-1.5 rounded-r-md transition-colors border-l',
                signsView === '30d'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-muted-foreground',
              ].join(' ')}
            >
              {ANALYTICS_COPY.chart.last30d}
            </button>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="mb-1 text-xs text-muted-foreground">{ANALYTICS_COPY.chart.signupsLabel}</p>
          <LineChart data={chartData} height={96} label={ANALYTICS_COPY.chart.signupsLabel} />

          {/* X-axis labels: first + last */}
          {chartData.length > 1 && (
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>
                {signsView === '7d' ? '7 days ago' : '30 days ago'}
              </span>
              <span>Today</span>
            </div>
          )}

          {/* Message volume mini-chart */}
          <p className="mb-1 mt-5 text-xs text-muted-foreground">{ANALYTICS_COPY.chart.messagesLabel}</p>
          <LineChart
            data={data.chats.last7dMessages}
            height={64}
            color="#10b981"
            label={ANALYTICS_COPY.chart.messagesLabel}
          />
        </div>
      </section>

      {/* Section 3 — Funnel */}
      <section aria-labelledby="section-funnel">
        <SectionHeader title={ANALYTICS_COPY.sections.funnel} />
        <div className="rounded-lg border bg-card p-5">
          <div className="space-y-3">
            <FunnelRow
              label={ANALYTICS_COPY.funnel.signedUp}
              value={data.users.total}
              pct={null}
              isFirst={true}
            />
            <FunnelRow
              label={ANALYTICS_COPY.funnel.mirrorComplete}
              value={mirrorCount}
              pct={data.onboarding.mirrorCompletionRate}
              isFirst={false}
            />
            <FunnelRow
              label={ANALYTICS_COPY.funnel.mentorAccepted}
              value={mentorAcceptedCount}
              pct={data.onboarding.mentorApprovalRate}
              isFirst={false}
            />
            <FunnelRow
              label={ANALYTICS_COPY.funnel.paidTier}
              value={paidCount}
              pct={totalUsersBase > 0 ? Math.round((paidCount / totalUsersBase) * 100 * 10) / 10 : 0}
              isFirst={false}
            />
          </div>

          {/* Onboarding rates legend */}
          <div className="mt-4 flex gap-6 border-t pt-4 text-xs text-muted-foreground">
            <span>
              Mirror completion:{' '}
              <strong className="text-foreground">{data.onboarding.mirrorCompletionRate}%</strong>
            </span>
            <span>
              Mentor application rate:{' '}
              <strong className="text-foreground">{data.onboarding.mentorApplicationRate}%</strong>
            </span>
            <span>
              Mentor approval rate:{' '}
              <strong className="text-foreground">{data.onboarding.mentorApprovalRate}%</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Section 4 — Subscription mix */}
      <section aria-labelledby="section-subscriptions">
        <SectionHeader title={ANALYTICS_COPY.sections.subscriptions} />
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">
              ₹{fmt.format(data.subscriptions.mrrInr)}
            </span>
            <span className="text-sm text-muted-foreground">/ month estimated MRR</span>
          </div>

          <div className="space-y-3">
            <HBar label="FREE" value={data.subscriptions.free} max={subMax} color="#94a3b8" />
            <HBar label="BASIC" value={data.subscriptions.basic} max={subMax} color="#3b82f6" />
            <HBar label="PRO" value={data.subscriptions.pro} max={subMax} color="#8b5cf6" />
            <HBar label="MAX" value={data.subscriptions.max} max={subMax} color="#f59e0b" />
          </div>

          <div className="mt-4 flex gap-6 border-t pt-3 text-xs text-muted-foreground">
            <span>
              BASIC: ₹399 ×{' '}
              <strong className="text-foreground">{fmt.format(data.subscriptions.basic)}</strong> ={' '}
              ₹{fmt.format(data.subscriptions.basic * 399)}
            </span>
            <span>
              PRO: ₹599 ×{' '}
              <strong className="text-foreground">{fmt.format(data.subscriptions.pro)}</strong> ={' '}
              ₹{fmt.format(data.subscriptions.pro * 599)}
            </span>
            <span>
              MAX: ₹999 ×{' '}
              <strong className="text-foreground">{fmt.format(data.subscriptions.max)}</strong> ={' '}
              ₹{fmt.format(data.subscriptions.max * 999)}
            </span>
          </div>
        </div>
      </section>

      {/* Section 5 — Moderation health */}
      <section aria-labelledby="section-moderation">
        <SectionHeader title={ANALYTICS_COPY.sections.moderation} />
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ANALYTICS_COPY.moderation.open}
            </p>
            <p
              className={[
                'mt-2 text-3xl font-bold tabular-nums',
                data.moderation.openReports > 0 ? 'text-destructive' : 'text-foreground',
              ].join(' ')}
            >
              {fmt.format(data.moderation.openReports)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ANALYTICS_COPY.moderation.actions30d}
            </p>
            <div className="space-y-2">
              <HBar
                label={ANALYTICS_COPY.moderation.warn}
                value={data.moderation.last30dActions.WARN}
                max={modMax}
                color="#f59e0b"
              />
              <HBar
                label={ANALYTICS_COPY.moderation.dismiss}
                value={data.moderation.last30dActions.DISMISS}
                max={modMax}
                color="#94a3b8"
              />
              <HBar
                label={ANALYTICS_COPY.moderation.suspend}
                value={data.moderation.last30dActions.SUSPEND}
                max={modMax}
                color="#ef4444"
              />
              <HBar
                label={ANALYTICS_COPY.moderation.ban}
                value={data.moderation.last30dActions.BAN}
                max={modMax}
                color="#991b1b"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 6 — Mentor verification */}
      <section aria-labelledby="section-verification">
        <SectionHeader title={ANALYTICS_COPY.sections.verification} />
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ANALYTICS_COPY.verification.pending}
            </p>
            <p
              className={[
                'mt-2 text-3xl font-bold tabular-nums',
                data.verification.pendingDocs > 0 ? 'text-amber-500' : 'text-foreground',
              ].join(' ')}
            >
              {fmt.format(data.verification.pendingDocs)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ANALYTICS_COPY.verification.approved7d}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-500">
              {fmt.format(data.verification.approvedLast7d)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ANALYTICS_COPY.verification.rejected7d}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {fmt.format(data.verification.rejectedLast7d)}
            </p>
          </div>
        </div>

        {/* Queue depth bar */}
        <div className="mt-4 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-4">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">Pending docs</span>
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{
                    width: `${Math.min(100, (data.verification.pendingDocs / Math.max(data.verification.pendingDocs + data.verification.approvedLast7d + data.verification.rejectedLast7d, 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <span className="w-12 text-right text-xs font-medium tabular-nums text-amber-500">
              {fmt.format(data.verification.pendingDocs)} waiting
            </span>
          </div>
        </div>
      </section>

      {/* Chat summary footer */}
      <section aria-labelledby="section-chat">
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex gap-8 text-sm">
            <div>
              <span className="text-muted-foreground">Pending chat requests: </span>
              <strong className="tabular-nums">{fmt.format(data.chats.pendingRequests)}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Accepted: </span>
              <strong className="tabular-nums">{fmt.format(data.chats.acceptedRequests)}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
