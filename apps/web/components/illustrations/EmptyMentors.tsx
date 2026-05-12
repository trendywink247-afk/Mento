import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * Magnifying glass over a list of rows — searching for mentors.
 * No faces. viewBox 200 × 160.
 */
export function EmptyMentors({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('h-40 w-auto', className)}
    >
      {/* List rows — three stacked */}
      <rect x="20" y="24" width="160" height="28" rx="6" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
      <circle cx="40" cy="38" r="8" fill="#cbd5e1" />
      <rect x="58" y="32" width="60" height="5" rx="2" fill="#cbd5e1" />
      <rect x="58" y="41" width="80" height="4" rx="2" fill="#e2e8f0" />

      <rect x="20" y="60" width="160" height="28" rx="6" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
      <circle cx="40" cy="74" r="8" fill="#cbd5e1" />
      <rect x="58" y="68" width="70" height="5" rx="2" fill="#cbd5e1" />
      <rect x="58" y="77" width="50" height="4" rx="2" fill="#e2e8f0" />

      <rect x="20" y="96" width="160" height="28" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 3" />
      <circle cx="40" cy="110" r="8" fill="#e2e8f0" />
      <rect x="58" y="104" width="50" height="5" rx="2" fill="#e2e8f0" />

      {/* Magnifying glass */}
      <circle cx="142" cy="62" r="26" fill="white" fillOpacity="0.9" stroke="#93c5fd" strokeWidth="3" />
      <circle cx="142" cy="62" r="18" fill="#dbeafe" stroke="#93c5fd" strokeWidth="2" />
      {/* Handle */}
      <line x1="161" y1="81" x2="176" y2="96" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
