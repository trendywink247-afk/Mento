import { Skeleton } from '@/components/Skeleton'

/**
 * Matches the footprint of a journal category button in /journals.
 * Width: full, height ~ 64px (p-4 + 2 lines of text).
 */
export function JournalCardSkeleton() {
  return (
    <div
      className="rounded-xl border bg-card p-4"
      aria-hidden="true"
    >
      {/* Category name line */}
      <Skeleton className="h-4 w-2/5" />
      {/* Subtitle line */}
      <Skeleton className="mt-2 h-3 w-3/5" />
    </div>
  )
}
