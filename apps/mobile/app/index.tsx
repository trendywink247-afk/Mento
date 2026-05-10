import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { getApiClient } from '@/lib/api'

type State =
  | { status: 'loading' }
  | { status: 'ok'; uptime: number }
  | { status: 'error'; message: string }

export default function Home() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let mounted = true
    getApiClient()
      .health()
      .then((res) => mounted && setState({ status: 'ok', uptime: res.uptime }))
      .catch((err: unknown) =>
        mounted &&
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        }),
      )
    return () => {
      mounted = false
    }
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Text className="text-4xl font-bold tracking-tight text-primary">Mento</Text>
        <Text className="text-center text-base text-muted">
          Personalised UPSC mentorship.{'\n'}Real-time chat with verified mentors.
        </Text>

        <View className="w-full max-w-sm gap-3">
          <Link href="/login" asChild>
            <Pressable className="rounded-md bg-primary px-6 py-3">
              <Text className="text-center font-medium text-white">Get started</Text>
            </Pressable>
          </Link>
        </View>

        <View className="rounded-md border border-gray-200 bg-gray-50 px-4 py-2">
          {state.status === 'loading' && (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" />
              <Text className="text-sm">Checking API…</Text>
            </View>
          )}
          {state.status === 'ok' && (
            <Text className="text-sm text-emerald-600">API ok — uptime {state.uptime}s</Text>
          )}
          {state.status === 'error' && (
            <Text className="text-sm text-red-600">API offline: {state.message}</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}
