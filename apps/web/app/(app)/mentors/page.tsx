'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { getApiClient } from '@/lib/api'
import { LANGUAGE_OPTIONS } from '@/lib/copy'
import { MentorCard, type MentorListItem } from '@/components/mentors/MentorCard'
import { MentorCardSkeleton } from '@/components/mentors/MentorCardSkeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type RateBand = '0-300' | '300-600' | '600-1000' | '1000+'

type Filters = {
  search: string
  statusPrelimsCleared: boolean
  statusMainsWritten: boolean
  statusInterviewAttended: boolean
  languages: string[]
  optionalSubject: string
  rateBand: RateBand | ''
}

const EMPTY_FILTERS: Filters = {
  search: '',
  statusPrelimsCleared: false,
  statusMainsWritten: false,
  statusInterviewAttended: false,
  languages: [],
  optionalSubject: '',
  rateBand: '',
}

type SortKey = 'online' | 'most-helped' | 'lowest-rate' | 'recently-joined'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'online', label: 'Online first' },
  { value: 'most-helped', label: 'Most-helped' },
  { value: 'lowest-rate', label: 'Lowest rate' },
  { value: 'recently-joined', label: 'Recently joined' },
]

// ─── Filter / sort helpers ────────────────────────────────────────────────────

function rateBandMatches(rate: number, band: RateBand | ''): boolean {
  if (!band) return true
  if (band === '0-300') return rate <= 300
  if (band === '300-600') return rate > 300 && rate <= 600
  if (band === '600-1000') return rate > 600 && rate <= 1000
  return rate > 1000
}

function applyFilters(mentors: MentorListItem[], f: Filters): MentorListItem[] {
  const q = f.search.trim().toLowerCase()
  return mentors.filter((m) => {
    if (q) {
      const hay = [m.displayHandle, m.optionalSubject ?? '', ...m.guidanceCategories, ...m.languages]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (f.statusPrelimsCleared && !m.prelimsCleared) return false
    if (f.statusMainsWritten && m.mainsAttempts === 0) return false
    if (f.statusInterviewAttended && m.interviewAttempts === 0) return false
    if (f.languages.length > 0) {
      const ml = m.languages.map((l) => l.toLowerCase())
      if (!f.languages.some((l) => ml.includes(l))) return false
    }
    if (f.optionalSubject.trim()) {
      if (!(m.optionalSubject ?? '').toLowerCase().includes(f.optionalSubject.trim().toLowerCase()))
        return false
    }
    if (!rateBandMatches(m.hourlyRateInr, f.rateBand)) return false
    return true
  })
}

function applySorting(mentors: MentorListItem[], sort: SortKey): MentorListItem[] {
  const arr = [...mentors]
  if (sort === 'online') arr.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))
  else if (sort === 'lowest-rate') arr.sort((a, b) => a.hourlyRateInr - b.hourlyRateInr)
  return arr
}

function countActiveFilters(f: Filters): number {
  let n = 0
  if (f.statusPrelimsCleared) n++
  if (f.statusMainsWritten) n++
  if (f.statusInterviewAttended) n++
  if (f.languages.length > 0) n++
  if (f.optionalSubject.trim()) n++
  if (f.rateBand) n++
  return n
}

// ─── Active chips ─────────────────────────────────────────────────────────────

type Chip = { key: string; label: string; remove: (f: Filters) => Filters }

function buildChips(f: Filters): Chip[] {
  const chips: Chip[] = []
  if (f.statusPrelimsCleared)
    chips.push({ key: 'prelims', label: 'Prelims cleared', remove: (x) => ({ ...x, statusPrelimsCleared: false }) })
  if (f.statusMainsWritten)
    chips.push({ key: 'mains', label: 'Mains written', remove: (x) => ({ ...x, statusMainsWritten: false }) })
  if (f.statusInterviewAttended)
    chips.push({ key: 'interview', label: 'Interview attended', remove: (x) => ({ ...x, statusInterviewAttended: false }) })
  f.languages.forEach((lang) => {
    const opt = LANGUAGE_OPTIONS.find((l) => l.value === lang)
    chips.push({
      key: `lang-${lang}`,
      label: opt?.label ?? lang,
      remove: (x) => ({ ...x, languages: x.languages.filter((l) => l !== lang) }),
    })
  })
  if (f.optionalSubject.trim())
    chips.push({ key: 'optional', label: `Optional: ${f.optionalSubject.trim()}`, remove: (x) => ({ ...x, optionalSubject: '' }) })
  if (f.rateBand)
    chips.push({ key: 'rate', label: `Rs.${f.rateBand}/hr`, remove: (x) => ({ ...x, rateBand: '' }) })
  return chips
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function MentorsPage() {
  const [allMentors, setAllMentors] = useState<MentorListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>('online')
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    getApiClient()
      .mentors.list()
      .then((rows) => mounted && setAllMentors(rows as MentorListItem[]))
      .catch((err: unknown) =>
        mounted && setError(err instanceof Error ? err.message : 'Failed to load mentors'),
      )
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!allMentors) return null
    return applySorting(applyFilters(allMentors, filters), sort)
  }, [allMentors, filters, sort])

  const activeFilterCount = countActiveFilters(filters)
  const chips = buildChips(filters)

  function patchFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function toggleLanguage(lang: string) {
    setFilters((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }))
  }

  const STATUS_CHECKBOXES: { key: keyof Filters; label: string }[] = [
    { key: 'statusPrelimsCleared', label: 'Prelims cleared' },
    { key: 'statusMainsWritten', label: 'Mains written' },
    { key: 'statusInterviewAttended', label: 'Interview attended' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find a mentor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified, anonymous mentors who have walked the UPSC path.
        </p>
      </div>

      {/* Search + sort row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => patchFilter('search', e.target.value)}
            placeholder="Search by handle, subject, category..."
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {filters.search && (
            <button
              onClick={() => patchFilter('search', '')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setPanelOpen((p) => !p)}
          className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors ${
            activeFilterCount > 0 || panelOpen
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background hover:bg-accent'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
        </button>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-10 shrink-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filter panel */}
      {panelOpen && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Journey status
              </p>
              <div className="space-y-2">
                {STATUS_CHECKBOXES.map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters[key] as boolean}
                      onChange={(e) =>
                        patchFilter(key, e.target.checked as Filters[typeof key])
                      }
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Language
              </p>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGE_OPTIONS.map((opt) => {
                  const active = filters.languages.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleLanguage(opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Optional subject
                </p>
                <input
                  type="text"
                  value={filters.optionalSubject}
                  onChange={(e) => patchFilter('optionalSubject', e.target.value)}
                  placeholder="e.g. Sociology"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  1:1 rate band
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(['0-300', '300-600', '600-1000', '1000+'] as RateBand[]).map((band) => (
                    <button
                      key={band}
                      onClick={() =>
                        patchFilter('rateBand', filters.rateBand === band ? '' : band)
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        filters.rateBand === band
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      {`Rs.${band}/hr`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              onClick={() => {
                setFilters(EMPTY_FILTERS)
                setPanelOpen(false)
              }}
              className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
            <button
              onClick={() => setPanelOpen(false)}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {chip.label}
              <button
                onClick={() => setFilters(chip.remove(filters))}
                className="ml-0.5 rounded-full hover:text-primary/70"
                aria-label={`Remove filter: ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Grid */}
      {filtered === null ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <MentorCardSkeleton key={i} />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <span className="text-4xl" role="img" aria-label="No results">
            &#x1F50D;
          </span>
          <p className="text-base font-medium">No mentors match your filters.</p>
          <p className="text-sm text-muted-foreground">
            Try relaxing a filter or clearing all to see everyone.
          </p>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-1 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} mentor{filtered.length !== 1 ? 's' : ''}
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map((m) => (
              <MentorCard key={m.userId} m={m} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
