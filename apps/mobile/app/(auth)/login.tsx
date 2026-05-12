import { useRef, useState } from 'react'
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
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const inputRef = useRef<TextInput>(null)

  const fullPhone = '+91' + phone.replace(/\D/g, '').slice(0, 10)

  async function handleSubmit() {
    setError(null)
    const parsed = phoneSchema.safeParse(fullPhone)
    if (!parsed.success) {
      setError('Enter a valid 10-digit mobile number')
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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Header */}
          <View className="mb-10">
            <Text className="text-3xl font-bold tracking-tight text-foreground">Welcome to Mento</Text>
            <Text className="mt-2 text-base text-muted">Sign in with your mobile number.</Text>
          </View>

          <View className="gap-5">
            {/* Phone field */}
            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Phone number</Text>
              {/* Input row with flag + prefix chip */}
              <Pressable
                onPress={() => inputRef.current?.focus()}
                className="flex-row items-center rounded-xl border border-border bg-white overflow-hidden"
              >
                {/* Flag + prefix chip */}
                <View className="flex-row items-center gap-1.5 border-r border-border bg-accent px-3 py-3.5">
                  <Text style={{ fontSize: 20 }}>🇮🇳</Text>
                  <Text className="text-base font-medium text-foreground">+91</Text>
                </View>
                {/* Bare digits */}
                <TextInput
                  ref={inputRef}
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  placeholder="98765 43210"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 px-3 py-3.5 text-base text-foreground"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </Pressable>
            </View>

            {error && <Text className="text-sm text-destructive">{error}</Text>}
            {devCode && (
              <View className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <Text className="text-xs text-amber-800">Dev OTP: {devCode}</Text>
              </View>
            )}

            <Pressable
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              onPress={handleSubmit}
              className="rounded-xl bg-primary px-4 py-4 disabled:opacity-50"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-center text-base font-semibold text-white">Send OTP</Text>
              )}
            </Pressable>

            {/* Privacy note */}
            <Text className="text-center text-xs leading-relaxed text-muted">
              Your details stay safe. You will interact anonymously within the community.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
