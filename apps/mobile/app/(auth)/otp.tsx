import { useState } from 'react'
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

export default function Otp() {
  const params = useLocalSearchParams<{ phone?: string }>()
  const phone = params.phone ?? ''
  const setSession = useAuthStore((s) => s.setSession)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          <View className="mb-8">
            <Text className="text-2xl font-bold tracking-tight">Verify your number</Text>
            <Text className="mt-1 text-sm text-muted">Enter the 6-digit code sent to</Text>
            <Text className="font-medium">{phone}</Text>
          </View>
          <View className="gap-4">
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="123456"
              className="rounded-md border border-gray-300 bg-white px-3 py-3 text-center text-2xl tracking-[0.5em]"
              autoFocus
            />
            {error && <Text className="text-sm text-red-600">{error}</Text>}
            <Pressable
              disabled={loading || code.length !== 6}
              onPress={handleSubmit}
              className="rounded-md bg-primary px-4 py-3 disabled:opacity-50"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-center text-base font-medium text-white">Verify & sign in</Text>
              )}
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
