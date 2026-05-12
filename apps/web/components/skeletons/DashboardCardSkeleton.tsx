import { Skeleton } from '@/components/Skeleton'

/**
 * Matches the footprint of a dashboard "next-step" card in /dashboard.
 * Has an icon circle, heading, body text, and a CTA link line.
 */
export function DashboardCardSkeleton() {
  return (
    <div
      className="flex flex-col rounded-2xl border bg-muted/30 p-6"
      aria-hidden="true"
    >
      {/* Icon circle */}
      <Skeleton className="mb-3 h-10 w-10 rounded-full" />
      {/* Card heading */}
      <Skeleton className="h-4 w-2/3" />
      {/* Body text — two lines */}
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-4/5" />
      {/* CTA link */}
      <Skeleton className="mt-4 h-3 w-1/3" />
    </div>
  )
}
