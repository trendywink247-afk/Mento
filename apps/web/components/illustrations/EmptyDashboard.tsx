import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * Sunrise / horizon — calm and forward-looking.
 * No faces. viewBox 200 × 160.
 */
export function EmptyDashboard({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('h-40 w-auto', className)}
    >
      {/* Sky gradient band */}
      <rect x="0" y="0" width="200" height="160" rx="12" fill="#f0f9ff" />

      {/* Horizon line */}
      <line x1="16" y1="110" x2="184" y2="110" stroke="#e2e8f0" strokeWidth="1.5" />

      {/* Sun circle */}
      <circle cx="100" cy="106" r="28" fill="#fef9c3" stroke="#fde68a" strokeWidth="2" />

      {/* Sun rays — 8 short dashes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180
        const x1 = 100 + Math.cos(rad) * 33
        const y1 = 106 + Math.sin(rad) * 33
        const x2 = 100 + Math.cos(rad) * 42
        const y2 = 106 + Math.sin(rad) * 42
        return (
          <line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#fbbf24"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )
      })}

      {/* Ground strip */}
      <rect x="0" y="110" width="200" height="50" rx="0" fill="#f1f5f9" />
      <rect x="0" y="148" width="200" height="12" rx="0" fill="#e2e8f0" />

      {/* Small path dots on ground */}
      <circle cx="100" cy="128" r="3" fill="#cbd5e1" />
      <circle cx="100" cy="140" r="3" fill="#e2e8f0" />

      {/* Distant horizon hills */}
      <ellipse cx="50" cy="110" rx="36" ry="14" fill="#e2e8f0" />
      <ellipse cx="158" cy="110" rx="30" ry="10" fill="#e2e8f0" />
    </svg>
  )
}
