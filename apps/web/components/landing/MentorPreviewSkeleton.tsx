export function MentorPreviewSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      {/* Avatar skeleton */}
      <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        {/* Handle skeleton */}
        <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
        {/* Journey skeleton */}
        <div className="h-3 w-48 animate-pulse rounded bg-muted/60" />
      </div>
      {/* Tag skeleton */}
      <div className="h-6 w-20 animate-pulse rounded-full bg-muted/60" />
    </div>
  )
}
