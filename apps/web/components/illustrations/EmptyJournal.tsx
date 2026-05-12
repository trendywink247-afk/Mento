import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * Open notebook with a pen — no faces, flat geometry.
 * viewBox 200 × 160.
 */
export function EmptyJournal({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('h-40 w-auto', className)}
    >
      {/* Book left page */}
      <rect x="30" y="36" width="64" height="88" rx="4" fill="#dbeafe" stroke="#bfdbfe" strokeWidth="1.5" />
      {/* Book right page */}
      <rect x="106" y="36" width="64" height="88" rx="4" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.5" />
      {/* Spine */}
      <rect x="95" y="32" width="10" height="96" rx="2" fill="#93c5fd" />

      {/* Left page lines */}
      <line x1="40" y1="60" x2="84" y2="60" stroke="#bfdbfe" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40" y1="72" x2="84" y2="72" stroke="#bfdbfe" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40" y1="84" x2="72" y2="84" stroke="#bfdbfe" strokeWidth="1.5" strokeLinecap="round" />

      {/* Right page lines (sparse, inviting) */}
      <line x1="116" y1="60" x2="160" y2="60" stroke="#e0f2fe" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="116" y1="72" x2="148" y2="72" stroke="#e0f2fe" strokeWidth="1.5" strokeLinecap="round" />

      {/* Pen body */}
      <rect x="152" y="92" width="8" height="36" rx="2" fill="#a5b4fc" transform="rotate(-30 152 92)" />
      {/* Pen nib */}
      <polygon points="162,117 168,128 155,126" fill="#818cf8" />
      {/* Pen clip */}
      <rect x="153" y="93" width="2" height="26" rx="1" fill="#c7d2fe" transform="rotate(-30 153 93)" />
    </svg>
  )
}
