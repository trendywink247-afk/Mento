'use client'

import type { AvatarColor, AvatarLetter } from '@mento/types'

const COLOR_MAP: Record<AvatarColor, { bg: string; fg: string }> = {
  SLATE: { bg: 'bg-slate-200', fg: 'text-slate-700' },
  AMBER: { bg: 'bg-amber-200', fg: 'text-amber-800' },
  SKY: { bg: 'bg-sky-200', fg: 'text-sky-800' },
  FOREST: { bg: 'bg-emerald-200', fg: 'text-emerald-800' },
  PURPLE: { bg: 'bg-purple-200', fg: 'text-purple-800' },
  GOLD: { bg: 'bg-gradient-to-br from-yellow-300 to-amber-400', fg: 'text-amber-900' },
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
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center rounded-full font-semibold ${c.bg} ${c.fg}`}
        style={{ fontSize: size * 0.45 }}
        aria-label={`Profile avatar: ${letter}`}
      >
        {letter}
      </div>
      {hasPurpleTick && (
        <div
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-purple-600 text-white shadow"
          style={{ width: size * 0.32, height: size * 0.32, fontSize: size * 0.2 }}
          aria-label="Verified"
          title="Verified"
        >
          ✓
        </div>
      )}
    </div>
  )
}
