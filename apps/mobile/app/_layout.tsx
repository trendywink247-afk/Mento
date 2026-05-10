import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Providers } from '@/components/providers'
import { useAuthStore } from '@/lib/auth-store'
import '../global.css'

function AuthGate() {
  const segments = useSegments()
  const router = useRouter()
  const { hydrated, hydrate, tokens } = useAuthStore()

  useEffect(() => {
    if (!hydrated) void hydrate()
  }, [hydrated, hydrate])

  useEffect(() => {
    if (!hydrated) return
    const inAuthGroup = segments[0] === '(auth)'
    const inOnboardingGroup = segments[0] === '(onboarding)'
    if (!tokens && !inAuthGroup && !inOnboardingGroup) {
      router.replace('/(onboarding)/role')
    }
  }, [hydrated, segments, tokens, router])

  return null
}

export default function RootLayout() {
  const hydrated = useAuthStore((s) => s.hydrated)

  return (
    <Providers>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <AuthGate />
        {!hydrated ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        )}
      </GestureHandlerRootView>
    </Providers>
  )
}
