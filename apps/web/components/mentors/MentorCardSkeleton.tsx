export function MentorCardSkeleton() {
  return (
    <li className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        {/* Avatar skeleton */}
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mt-2.5 h-3 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-3 flex gap-2">
        <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
      </div>
    </li>
  )
}
