import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useEffect, useRef } from 'react'
import { ActivityIndicator, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { Providers } from '@/components/providers'
import { useAuthStore } from '@/lib/auth-store'
import { initAnalytics } from '@/lib/analytics'
import '../global.css'

// Show banner + play sound when a notification arrives while app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

// Initialise PostHog at module level so events during early startup are captured.
// No-op when EXPO_PUBLIC_POSTHOG_KEY is absent.
initAnalytics()

// Initialise Sentry (native crashes + JS errors).
// We use require() to avoid a dynamic-import-in-module-scope issue with TSC.
// No-op when EXPO_PUBLIC_SENTRY_DSN is absent.
if (process.env.EXPO_PUBLIC_SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native')
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      enabled: true,
    })
  } catch {
    // Swallow — Sentry native module unavailable in some build configs.
  }
}

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
  const router = useRouter()
  const notificationListener = useRef<Notifications.EventSubscription | null>(null)
  const responseListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    // Handle notification tap when app was backgrounded or closed.
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, string> | undefined
        if (data?.conversationId) {
          router.push(`/(tabs)/chat/${data.conversationId}`)
        }
      },
    )
    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [router])

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
