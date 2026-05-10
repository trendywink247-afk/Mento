import { Pressable, SafeAreaView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'

export default function Profile() {
  const { user, profile, tokens, clear } = useAuthStore()

  async function handleLogout() {
    if (tokens) {
      await getApiClient().auth.logout(tokens.refreshToken).catch(() => {})
    }
    await clear()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-6">
        <View className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <Text className="text-xs text-muted">Display name</Text>
          <Text className="mt-1 text-base font-medium">{profile?.displayName ?? '—'}</Text>
          <Text className="mt-3 text-xs text-muted">Phone</Text>
          <Text className="mt-1 text-base">{user?.phone ?? '—'}</Text>
          <Text className="mt-3 text-xs text-muted">Role</Text>
          <Text className="mt-1 text-base">{user?.role}</Text>
        </View>
        <Pressable onPress={handleLogout} className="mt-6 rounded-md border border-gray-300 px-4 py-3">
          <Text className="text-center text-base">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
