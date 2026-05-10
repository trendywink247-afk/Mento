import { View, Text } from 'react-native'
import type { AvatarColor, AvatarLetter } from '@mento/types'

const COLOR_MAP: Record<AvatarColor, { bg: string; fg: string }> = {
  SLATE: { bg: '#e2e8f0', fg: '#334155' },
  AMBER: { bg: '#fde68a', fg: '#92400e' },
  SKY: { bg: '#bae6fd', fg: '#075985' },
  FOREST: { bg: '#bbf7d0', fg: '#065f46' },
  PURPLE: { bg: '#e9d5ff', fg: '#581c87' },
  GOLD: { bg: '#fde68a', fg: '#92400e' },
}

interface Props {
  letter: AvatarLetter
  color: AvatarColor
  hasPurpleTick?: boolean
  size?: number
}

export function LetterAvatar({ letter, color, hasPurpleTick, size = 40 }: Props) {
  const c = COLOR_MAP[color]
  const tickSize = size * 0.32
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: c.fg, fontSize: size * 0.45, fontWeight: '600' }}>{letter}</Text>
      </View>
      {hasPurpleTick && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: tickSize,
            height: tickSize,
            borderRadius: tickSize / 2,
            backgroundColor: '#7c3aed',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: tickSize * 0.6, fontWeight: '700' }}>✓</Text>
        </View>
      )}
    </View>
  )
}
