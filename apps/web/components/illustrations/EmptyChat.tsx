import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * Two speech bubbles — one filled (sent), one outlined (waiting).
 * No faces. viewBox 200 × 160.
 */
export function EmptyChat({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('h-40 w-auto', className)}
    >
      {/* Bubble 1 — filled (sent message) */}
      <rect x="20" y="30" width="110" height="52" rx="14" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
      {/* Tail left */}
      <path d="M34 82 L20 98 L54 82Z" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Dots inside bubble 1 */}
      <circle cx="52" cy="56" r="4" fill="#93c5fd" />
      <circle cx="75" cy="56" r="4" fill="#93c5fd" />
      <circle cx="98" cy="56" r="4" fill="#93c5fd" />

      {/* Bubble 2 — outlined (awaiting reply) */}
      <rect x="70" y="90" width="110" height="48" rx="14" fill="white" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Tail right */}
      <path d="M166 138 L180 154 L146 138Z" fill="white" stroke="#e2e8f0" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 3" />
      {/* Three dots in bubble 2 */}
      <circle cx="108" cy="114" r="3.5" fill="#cbd5e1" />
      <circle cx="125" cy="114" r="3.5" fill="#cbd5e1" />
      <circle cx="142" cy="114" r="3.5" fill="#cbd5e1" />
    </svg>
  )
}
