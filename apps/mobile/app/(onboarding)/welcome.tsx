import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, SafeAreaView, Text, View } from 'react-native'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COPY } from '@/lib/copy'
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

const ALL_LINES = [...COPY.welcome, ...COPY.notAPlace, COPY.reflection, COPY.brand]
const MS_PER_LINE = 900
const FADE_MS = 300
const INTRO_KEY = 'mento.intro_seen'

export default function Welcome() {
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(false)
  const opacity = useRef(new Animated.Value(0)).current

  // Check if already seen
  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY).then((val) => {
      if (val === '1') {
        // Returning user — skip silently, no analytics event.
        AsyncStorage.setItem(INTRO_KEY, '1').catch(() => {})
        router.replace('/(auth)/login?role=ASPIRANT')
      } else {
        capture(ANALYTICS_EVENTS.WELCOME_FLASH_VIEWED)
      }
    })
  }, [])

  function navigateAway(reason: 'completed' | 'skipped') {
    if (reason === 'skipped') {
      capture(ANALYTICS_EVENTS.WELCOME_FLASH_SKIPPED)
    } else {
      capture(ANALYTICS_EVENTS.WELCOME_FLASH_COMPLETED)
    }
    AsyncStorage.setItem(INTRO_KEY, '1').catch(() => {})
    router.replace('/(auth)/login?role=ASPIRANT')
  }

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigateAway('completed'), 600)
      return () => clearTimeout(t)
    }
  }, [done])

  useEffect(() => {
    if (idx >= ALL_LINES.length) {
      setDone(true)
      return
    }
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.delay(MS_PER_LINE - FADE_MS * 2),
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setIdx((i) => i + 1)
    })
  }, [idx, opacity])

  if (done) return null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Animated.Text
          style={{
            opacity,
            fontSize: 22,
            fontWeight: '500',
            textAlign: 'center',
            lineHeight: 30,
            color: '#0f172a',
          }}
        >
          {ALL_LINES[idx]}
        </Animated.Text>

        {/* Dot strip — progress indicator */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 48 }}>
          {ALL_LINES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === idx ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === idx ? '#2563eb' : '#e2e8f0',
              }}
            />
          ))}
        </View>
      </View>

      {/* Skip button */}
      <View style={{ paddingBottom: 32, paddingHorizontal: 32 }}>
        <Pressable onPress={() => navigateAway('skipped')} hitSlop={12}>
          <Text style={{ textAlign: 'center', fontSize: 14, color: '#64748b' }}>Skip</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
