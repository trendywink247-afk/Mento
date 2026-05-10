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
import { router } from 'expo-router'
import { phoneSchema } from '@mento/validation'
import { getApiClient } from '@/lib/api'

export default function Login() {
  const [phone, setPhone] = useState('+91')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    const parsed = phoneSchema.safeParse(phone)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid phone')
      return
    }
    setLoading(true)
    try {
      const res = await getApiClient().auth.requestOtp(parsed.data)
      if (res.devCode) setDevCode(res.devCode)
      router.push({ pathname: '/(auth)/otp', params: { phone: parsed.data } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP')
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
            <Text className="text-3xl font-bold tracking-tight">Welcome to Mento</Text>
            <Text className="mt-2 text-base text-muted">Sign in with your mobile number.</Text>
          </View>
          <View className="gap-4">
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700">Phone number</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+919876543210"
                className="rounded-md border border-gray-300 bg-white px-3 py-3 text-base"
                autoFocus
              />
            </View>
            {error && <Text className="text-sm text-red-600">{error}</Text>}
            {devCode && <Text className="text-xs text-muted">Dev OTP: {devCode}</Text>}
            <Pressable
              disabled={loading}
              onPress={handleSubmit}
              className="rounded-md bg-primary px-4 py-3 disabled:opacity-50"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-center text-base font-medium text-white">Send OTP</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
