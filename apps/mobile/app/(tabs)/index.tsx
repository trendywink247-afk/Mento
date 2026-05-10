import { SafeAreaView, Text, View } from 'react-native'
import { useAuthStore } from '@/lib/auth-store'

export default function Home() {
  const { user, profile } = useAuthStore()
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-6">
        <Text className="text-2xl font-bold tracking-tight">Welcome to Mento</Text>
        <Text className="mt-2 text-sm text-muted">
          Signed in as {profile?.displayName ?? user?.phone}
        </Text>
        <Text className="mt-1 text-xs text-muted">Role: {user?.role}</Text>
        <View className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4">
          <Text className="text-sm text-muted">
            Phase 2 will replace this with your conversation list and live chat.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
