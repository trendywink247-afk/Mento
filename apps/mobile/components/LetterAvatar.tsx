import { View, Text } from 'react-native'
import type { AvatarColor, AvatarLetter } from '@mento/types'

// Light-mode B2C palette mirroring the web LetterAvatar.
const COLOR_MAP: Record<AvatarColor, { bg: string; fg: string }> = {
  SLATE:  { bg: '#e2e8f0', fg: '#334155' },
  AMBER:  { bg: '#fef3c7', fg: '#92400e' },
  SKY:    { bg: '#dbeafe', fg: '#1e40af' },
  FOREST: { bg: '#d1fae5', fg: '#065f46' },
  PURPLE: { bg: '#ede9fe', fg: '#5b21b6' },
  GOLD:   { bg: '#fcd34d', fg: '#78350f' }, // simple solid; gradient not worth deps cost
}

interface Props {
  letter: AvatarLetter
  color: AvatarColor
  hasPurpleTick?: boolean
  size?: number
}

export function LetterAvatar({ letter, color, hasPurpleTick, size = 40 }: Props) {
  const c = COLOR_MAP[color]
  const tickSize = size * 0.36
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
          borderWidth: 1,
          borderColor: 'rgba(15,23,42,0.06)',
        }}
      >
        <Text style={{ color: c.fg, fontSize: size * 0.42, fontWeight: '600' }}>{letter}</Text>
      </View>
      {hasPurpleTick && (
        <View
          accessibilityLabel="Verified mentor"
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: tickSize,
            height: tickSize,
            borderRadius: tickSize / 2,
            backgroundColor: '#7c3aed',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#ffffff',
          }}
        >
          <Text style={{ color: 'white', fontSize: tickSize * 0.5, fontWeight: '700' }}>✓</Text>
        </View>
      )}
    </View>
  )
}
