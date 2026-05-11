'use client'

import type { AvatarColor, AvatarLetter } from '@mento/types'

// Light-mode B2C palette per spec section 1.17. Soft, calm, light foregrounds.
const COLOR_MAP: Record<AvatarColor, { bg: string; fg: string }> = {
  SLATE:  { bg: 'bg-slate-200',  fg: 'text-slate-700' },
  AMBER:  { bg: 'bg-amber-100',  fg: 'text-amber-800' },
  SKY:    { bg: 'bg-blue-100',   fg: 'text-blue-800' },
  FOREST: { bg: 'bg-emerald-100', fg: 'text-emerald-800' },
  PURPLE: { bg: 'bg-violet-100', fg: 'text-violet-800' },
  GOLD:   { bg: 'bg-gradient-to-br from-amber-100 to-amber-300', fg: 'text-amber-900' },
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
        className={`flex h-full w-full items-center justify-center rounded-full font-semibold ring-1 ring-black/5 ${c.bg} ${c.fg}`}
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
