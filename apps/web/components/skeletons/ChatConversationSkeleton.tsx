import { Skeleton } from '@/components/Skeleton'

/**
 * Matches the footprint of a conversation row in /chat.
 * Mirrors the avatar + handle + snippet + timestamp layout.
 */
export function ChatConversationSkeleton() {
  return (
    <li
      className="flex items-start gap-3 p-4"
      aria-hidden="true"
    >
      {/* Avatar circle */}
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex justify-between">
          {/* Handle */}
          <Skeleton className="h-4 w-28" />
          {/* Time */}
          <Skeleton className="h-3 w-10" />
        </div>
        {/* Last message snippet */}
        <Skeleton className="h-3 w-4/5" />
      </div>
    </li>
  )
}
