import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { otpCodeSchema } from '@mento/validation'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { identify } from '@/lib/analytics'
import { registerForPushNotifications } from '@/lib/push'

const CELL_COUNT = 6

export default function Otp() {
  const params = useLocalSearchParams<{ phone?: string; role?: string }>()
  const phone = params.phone ?? ''
  const setSession = useAuthStore((s) => s.setSession)

  const [digits, setDigits] = useState<string[]>(Array(CELL_COUNT).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(30)
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<Array<TextInput | null>>(Array(CELL_COUNT).fill(null))
  const hiddenRef = useRef<TextInput>(null)

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const t = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [countdown])

  const code = digits.join('')

  async function handleSubmit() {
    setError(null)
    const parsed = otpCodeSchema.safeParse(code)
    if (!parsed.success) {
      setError('Enter the 6-digit code')
      return
    }
    if (!phone) {
      setError('Missing phone; go back')
      return
    }
    setLoading(true)
    try {
      const session = await getApiClient().auth.verifyOtp(phone, parsed.data)
      await setSession(session)
      identify(session.user.id, { role: session.user.role })
      // Register push token — fire-and-forget, must not block sign-in.
      void registerForPushNotifications()
      if (process.env.EXPO_PUBLIC_SENTRY_DSN && process.env.NODE_ENV !== 'test') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native')
          Sentry.setUser({ id: session.user.id })
        } catch {
          // Sentry native module unavailable in some build configs.
        }
      }
      const state = await getApiClient().onboarding.state().catch(() => null)
      const rolePick = String(params.role ?? '')
      if (rolePick === 'MENTOR' && (!state || !state.mentorOnboardingSubmitted)) {
        router.replace('/(onboarding)/mentor')
        return
      }
      if (state?.nextStep === 'mentee.mirror') {
        router.replace('/(onboarding)/mirror')
        return
      }
      if (state?.nextStep === 'mentor.journey' || state?.nextStep === 'mentor.credentials') {
        router.replace('/(onboarding)/mentor')
        return
      }
      if (state?.nextStep === 'mentor.waiting_verification') {
        router.replace('/(onboarding)/submitted')
        return
      }
      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (countdown > 0 || resending) return
    setResending(true)
    try {
      await getApiClient().auth.requestOtp(phone)
      setCountdown(30)
      setDigits(Array(CELL_COUNT).fill(''))
      inputRefs.current[0]?.focus()
    } catch {
      // silently fail — user can try again
    } finally {
      setResending(false)
    }
  }

  function handleCellChange(text: string, idx: number) {
    const digit = text.replace(/\D/g, '').slice(-1)
    const next = digits.slice()
    next[idx] = digit
    setDigits(next)
    if (digit && idx < CELL_COUNT - 1) {
      inputRefs.current[idx + 1]?.focus()
    }
    // Auto-submit when last digit filled
    if (digit && idx === CELL_COUNT - 1) {
      const full = next.join('')
      if (full.length === CELL_COUNT) {
        // Small timeout so state has propagated
        setTimeout(handleSubmit, 80)
      }
    }
  }

  function handleKeyPress(key: string, idx: number) {
    if (key === 'Backspace') {
      const next = digits.slice()
      if (next[idx]) {
        next[idx] = ''
        setDigits(next)
      } else if (idx > 0) {
        next[idx - 1] = ''
        setDigits(next)
        inputRefs.current[idx - 1]?.focus()
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-2xl font-bold tracking-tight text-foreground">Verify your number</Text>
            <Text className="mt-1 text-sm text-muted">Enter the 6-digit code sent to</Text>
            <Text className="font-semibold text-foreground">{phone}</Text>
          </View>

          {/* 6-cell OTP input */}
          <View className="flex-row justify-between gap-2 mb-5">
            {Array.from({ length: CELL_COUNT }).map((_, idx) => (
              <TextInput
                key={idx}
                ref={(r) => { inputRefs.current[idx] = r }}
                value={digits[idx]}
                onChangeText={(t) => handleCellChange(t, idx)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={idx === 0}
                style={{
                  flex: 1,
                  height: 56,
                  borderWidth: 1.5,
                  borderColor: digits[idx] ? '#2563eb' : '#e2e8f0',
                  borderRadius: 12,
                  backgroundColor: '#ffffff',
                  fontSize: 22,
                  fontWeight: '600',
                  textAlign: 'center',
                  color: '#0f172a',
                }}
              />
            ))}
          </View>

          {error && <Text className="mb-3 text-sm text-destructive">{error}</Text>}

          <Pressable
            disabled={loading || code.length !== CELL_COUNT}
            onPress={handleSubmit}
            className="rounded-xl bg-primary px-4 py-4 disabled:opacity-50"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-center text-base font-semibold text-white">Verify & sign in</Text>
            )}
          </Pressable>

          {/* Resend + use different number */}
          <View className="mt-5 gap-3">
            <Pressable
              onPress={handleResend}
              disabled={countdown > 0 || resending}
            >
              <Text className="text-center text-sm text-muted">
                {countdown > 0
                  ? `Resend code in ${countdown}s`
                  : resending
                  ? 'Sending…'
                  : 'Resend code'}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.back()}>
              <Text className="text-center text-xs text-muted">Use a different number</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
