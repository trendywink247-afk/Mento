import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * Paper plane soaring in a calm sky — submission confirmation.
 * No faces. viewBox 200 × 160.
 */
export function Submitted({ className }: Props) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('h-40 w-auto', className)}
    >
      {/* Sky background */}
      <rect x="0" y="0" width="200" height="160" rx="12" fill="#f0f9ff" />

      {/* Soft cloud left */}
      <ellipse cx="38" cy="52" rx="22" ry="13" fill="white" fillOpacity="0.85" />
      <ellipse cx="26" cy="56" rx="14" ry="10" fill="white" fillOpacity="0.85" />
      <ellipse cx="52" cy="56" rx="14" ry="10" fill="white" fillOpacity="0.85" />

      {/* Soft cloud right */}
      <ellipse cx="162" cy="108" rx="18" ry="10" fill="white" fillOpacity="0.7" />
      <ellipse cx="152" cy="112" rx="12" ry="8" fill="white" fillOpacity="0.7" />
      <ellipse cx="174" cy="112" rx="11" ry="7" fill="white" fillOpacity="0.7" />

      {/* Trail dots (path plane traveled) */}
      <circle cx="50" cy="100" r="2.5" fill="#bfdbfe" />
      <circle cx="64" cy="91" r="2" fill="#bfdbfe" />
      <circle cx="78" cy="83" r="2" fill="#bfdbfe" />
      <circle cx="92" cy="76" r="1.5" fill="#93c5fd" />
      <circle cx="106" cy="70" r="1.5" fill="#93c5fd" />

      {/* Paper plane body */}
      <g transform="translate(118, 58) rotate(-20)">
        {/* Main wing */}
        <path d="M0 0 L40 12 L20 20Z" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" strokeLinejoin="round" />
        {/* Lower wing */}
        <path d="M0 0 L20 20 L8 28Z" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.2" strokeLinejoin="round" />
        {/* Fold crease */}
        <line x1="0" y1="0" x2="20" y2="20" stroke="#93c5fd" strokeWidth="1" strokeDasharray="2 2" />
      </g>

      {/* Stars / sparkles */}
      <circle cx="152" cy="40" r="2" fill="#fde68a" />
      <circle cx="168" cy="55" r="1.5" fill="#fde68a" />
      <circle cx="144" cy="60" r="1" fill="#fde68a" />
      <circle cx="60" cy="130" r="1.5" fill="#c7d2fe" />
      <circle cx="78" cy="140" r="1" fill="#c7d2fe" />
    </svg>
  )
}
