import { useEffect, useRef, useState } from 'react'
import { Animated, SafeAreaView, View, Text } from 'react-native'

interface Props {
  lines: readonly string[]
  msPerLine?: number
  fadeMs?: number
  onDone?: () => void
}

export function FlashSequence({ lines, msPerLine = 1500, fadeMs = 400, onDone }: Props) {
  const [idx, setIdx] = useState(0)
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (idx >= lines.length) {
      onDone?.()
      return
    }
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: fadeMs, useNativeDriver: true }),
      Animated.delay(msPerLine - fadeMs * 2),
      Animated.timing(opacity, { toValue: 0, duration: fadeMs, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setIdx(idx + 1)
    })
  }, [idx, lines, msPerLine, fadeMs, onDone, opacity])

  if (idx >= lines.length) return null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Animated.Text
          style={{
            opacity,
            fontSize: 22,
            fontWeight: '500',
            textAlign: 'center',
            lineHeight: 30,
          }}
        >
          {lines[idx]}
        </Animated.Text>
      </View>
    </SafeAreaView>
  )
}
