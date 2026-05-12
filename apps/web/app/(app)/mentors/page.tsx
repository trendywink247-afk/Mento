'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getApiClient } from '@/lib/api'
import { LANGUAGE_OPTIONS } from '@/lib/copy'
import { MentorCard, type MentorListItem } from '@/components/mentors/MentorCard'
import { MentorCardSkeleton } from '@/components/mentors/MentorCardSkeleton'
import { EmptyMentors } from '@/components/illustrations/EmptyMentors'
import { MotionFade, MotionStagger, MotionStaggerItem } from '@/components/motion'

type RateBand = '0-300' | '300-600' | '600-1000' | '1000+'
type SortKey = 'online' | 'helped' | 'rate-asc' | 'recent'

interface Filters {
  search: string
  statusPrelimsCleared: boolean
  statusMainsWritten: boolean
  statusInterviewAttended: boolean
  languages: string[]
  optionalSubject: string
  rateBand: RateBand | null
}

const EMPTY_FILTERS: Filters = {
  search: '',
  statusPrelimsCleared: false,
  statusMainsWritten: false,
  statusInterviewAttended: false,
  languages: [],
  optionalSubject: '',
  rateBand: null,
}

function rateInBand(rate: number, band: RateBand): boolean {
  switch (band) {
    case '0-300':
      return rate <= 300
    case '300-600':
      return rate > 300 && rate <= 600
    case '600-1000':
      return rate > 600 && rate <= 1000
    case '1000+':
      return rate > 1000
  }
}

function countActiveFilters(f: Filters): number {
  let n = 0
  if (f.statusPrelimsCleared) n++
  if (f.statusMainsWritten) n++
  if (f.statusInterviewAttended) n++
  n += f.languages.length
  if (f.optionalSubject.trim()) n++
  if (f.rateBand) n++
  return n
}

export default function MentorsPage() {
  const t = useTranslations('mentors')
  const [mentors, setMentors] = useState<MentorListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sort, setSort] = useState<SortKey>('online')

  useEffect(() => {
    let mounted = true
    getApiClient()
      .mentors.list()
      .then((rows) => mounted && setMentors(rows as MentorListItem[]))
      .catch((err: unknown) =>
        mounted && setError(err instanceof Error ? err.message : 'Failed to load'),
      )
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!mentors) return []
    const q = filters.search.trim().toLowerCase()
    let rows = mentors.filter((m) => {
      if (q) {
        const hay = [
          m.displayHandle,
          m.optionalSubject ?? '',
          m.guidanceCategories.join(' '),
          m.languages.join(' '),
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filters.statusPrelimsCleared && !m.prelimsCleared) return false
      if (filters.statusMainsWritten && m.mainsAttempts === 0) return false
      if (filters.statusInterviewAttended && m.interviewAttempts === 0) return false
      if (filters.languages.length > 0 && !filters.languages.some((l) => m.languages.includes(l)))
        return false
      if (
        filters.optionalSubject.trim() &&
        !(m.optionalSubject ?? '')
          .toLowerCase()
          .includes(filters.optionalSubject.trim().toLowerCase())
      )
        return false
      if (filters.rateBand && !rateInBand(m.hourlyRateInr, filters.rateBand)) return false
      return true
    })

    rows = rows.slice()
    switch (sort) {
      case 'online':
        rows.sort(
          (a, b) =>
            Number(b.online ?? 0) - Number(a.online ?? 0) ||
            a.displayHandle.localeCompare(b.displayHandle),
        )
        break
      case 'helped':
        rows.sort((a, b) => Number(b.isVerified) - Number(a.isVerified))
        break
      case 'rate-asc':
        rows.sort((a, b) => a.hourlyRateInr - b.hourlyRateInr)
        break
      case 'recent':
        break
    }
    return rows
  }, [mentors, filters, sort])

  const active = countActiveFilters(filters)

  return (
    <div className="space-y-6">
      <MotionFade>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </MotionFade>

      <MotionFade delay={0.05}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <label htmlFor="mentor-search" className="sr-only">
              Search mentors
            </label>
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="mentor-search"
              type="search"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-full border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="mentor-filters-panel"
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              active > 0 ? 'border-primary bg-primary/5 text-primary' : 'border-input bg-background'
            }`}
          >
            <SlidersHorizontal size={14} />
            {t('filters')}
            {active > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                {active}
              </span>
            )}
          </button>
          <label htmlFor="mentor-sort" className="sr-only">
            Sort mentors
          </label>
          <select
            id="mentor-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="online">{t('sort.onlineFirst')}</option>
            <option value="helped">{t('sort.mostHelped')}</option>
            <option value="rate-asc">{t('sort.lowestRate')}</option>
            <option value="recent">{t('sort.recentlyJoined')}</option>
          </select>
        </div>
      </MotionFade>

      {active > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.statusPrelimsCleared && (
            <FilterChip
              label={t('chips.prelimsCleared')}
              onRemove={() => setFilters({ ...filters, statusPrelimsCleared: false })}
            />
          )}
          {filters.statusMainsWritten && (
            <FilterChip
              label={t('chips.mainsWritten')}
              onRemove={() => setFilters({ ...filters, statusMainsWritten: false })}
            />
          )}
          {filters.statusInterviewAttended && (
            <FilterChip
              label={t('chips.interviewAttended')}
              onRemove={() => setFilters({ ...filters, statusInterviewAttended: false })}
            />
          )}
          {filters.languages.map((l) => (
            <FilterChip
              key={l}
              label={LANGUAGE_OPTIONS.find((x) => x.value === l)?.label ?? l}
              onRemove={() =>
                setFilters({ ...filters, languages: filters.languages.filter((x) => x !== l) })
              }
            />
          ))}
          {filters.optionalSubject.trim() && (
            <FilterChip
              label={t('chips.optionalPrefix', { subject: filters.optionalSubject })}
              onRemove={() => setFilters({ ...filters, optionalSubject: '' })}
            />
          )}
          {filters.rateBand && (
            <FilterChip
              label={`₹${filters.rateBand}`}
              onRemove={() => setFilters({ ...filters, rateBand: null })}
            />
          )}
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {t('clearAll')}
          </button>
        </div>
      )}

      {filtersOpen && (
        <MotionFade>
          <div id="mentor-filters-panel" className="space-y-4 rounded-2xl border bg-card p-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('filterSections.upscStatus')}
              </p>
              <div className="flex flex-wrap gap-2">
                <CheckChip
                  label={t('chips.prelimsCleared')}
                  value={filters.statusPrelimsCleared}
                  onChange={(v) => setFilters({ ...filters, statusPrelimsCleared: v })}
                />
                <CheckChip
                  label={t('chips.mainsWritten')}
                  value={filters.statusMainsWritten}
                  onChange={(v) => setFilters({ ...filters, statusMainsWritten: v })}
                />
                <CheckChip
                  label={t('chips.interviewAttended')}
                  value={filters.statusInterviewAttended}
                  onChange={(v) => setFilters({ ...filters, statusInterviewAttended: v })}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('filterSections.languages')}
              </p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((l) => (
                  <CheckChip
                    key={l.value}
                    label={l.label}
                    value={filters.languages.includes(l.value)}
                    onChange={(v) =>
                      setFilters({
                        ...filters,
                        languages: v
                          ? [...filters.languages, l.value]
                          : filters.languages.filter((x) => x !== l.value),
                      })
                    }
                  />
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="filter-optional-subject" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('filterSections.optionalSubject')}
              </label>
              <input
                id="filter-optional-subject"
                value={filters.optionalSubject}
                onChange={(e) => setFilters({ ...filters, optionalSubject: e.target.value })}
                placeholder={t('optionalSubjectPlaceholder')}
                className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('filterSections.rateBand')}
              </p>
              <div className="flex flex-wrap gap-2">
                {(['0-300', '300-600', '600-1000', '1000+'] as RateBand[]).map((band) => (
                  <CheckChip
                    key={band}
                    label={`₹${band}/hr`}
                    value={filters.rateBand === band}
                    onChange={(v) => setFilters({ ...filters, rateBand: v ? band : null })}
                  />
                ))}
              </div>
            </div>
          </div>
        </MotionFade>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {mentors === null ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <MentorCardSkeleton key={i} />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <EmptyMentors className="mx-auto h-32 w-auto" />
          <p className="mt-4 text-base font-medium">{t('noMatches')}</p>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('clearFilters')}
          </button>
        </div>
      ) : (
        <MotionStagger staggerDelay={0.04}>
          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map((m) => (
              <MotionStaggerItem key={m.userId}>
                <MentorCard m={m} />
              </MotionStaggerItem>
            ))}
          </ul>
        </MotionStagger>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      aria-label={`Remove filter: ${label}`}
      className="inline-flex items-center gap-1 rounded-full border bg-primary/5 px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
    >
      {label}
      <X size={12} aria-hidden />
    </button>
  )
}

function CheckChip({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        value ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'
      }`}
    >
      {label}
    </button>
  )
}
