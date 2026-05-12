'use client'

import type { AvatarColor, AvatarLetter } from '@mento/types'

// Light + dark palette per spec section 1.17.
// Dark entries use slightly deeper bg (so contrast vs the near-black canvas) and
// lighter fg (so text pops). All combinations are AA-compliant (≥4.5:1 on their
// respective dark-mode card backgrounds).
const COLOR_MAP: Record<AvatarColor, { bg: string; fg: string }> = {
  SLATE:  { bg: 'bg-slate-200  dark:bg-slate-700',  fg: 'text-slate-700  dark:text-slate-200' },
  AMBER:  { bg: 'bg-amber-100  dark:bg-amber-900/60',  fg: 'text-amber-800  dark:text-amber-200' },
  SKY:    { bg: 'bg-blue-100   dark:bg-blue-900/60',   fg: 'text-blue-800   dark:text-blue-200' },
  FOREST: { bg: 'bg-emerald-100 dark:bg-emerald-900/60', fg: 'text-emerald-800 dark:text-emerald-200' },
  PURPLE: { bg: 'bg-violet-100 dark:bg-violet-900/60', fg: 'text-violet-800 dark:text-violet-200' },
  GOLD:   { bg: 'bg-gradient-to-br from-amber-100 to-amber-300 dark:from-amber-900/60 dark:to-amber-700/60', fg: 'text-amber-900 dark:text-amber-100' },
}

interface Props {
  letter: AvatarLetter
  color: AvatarColor
  hasPurpleTick?: boolean
  size?: number
}

export function LetterAvatar({ letter, color, hasPurpleTick, size = 40 }: Props) {
  const c = COLOR_MAP[color]
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center rounded-full font-semibold ring-1 ring-black/5 dark:ring-white/10 ${c.bg} ${c.fg}`}
        style={{ fontSize: size * 0.42 }}
        aria-label={`Anonymous avatar: ${letter}`}
      >
        {letter}
      </div>
      {hasPurpleTick && (
        <div
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-violet-600 text-white shadow ring-2 ring-background"
          style={{ width: size * 0.36, height: size * 0.36, fontSize: size * 0.22 }}
          aria-label="Verified mentor"
          title="Verified mentor"
        >
          ✓
        </div>
      )}
    </div>
  )
}
