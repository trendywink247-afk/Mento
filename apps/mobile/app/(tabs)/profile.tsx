import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { LetterAvatar } from '@/components/LetterAvatar'
import { unregisterPushNotifications } from '@/lib/push'

export default function Profile() {
  const { user, profile, tokens, clear } = useAuthStore()

  async function handleLogout() {
    // Remove push token from server before clearing session.
    await unregisterPushNotifications()
    if (tokens) {
      await getApiClient().auth.logout(tokens.refreshToken).catch(() => {})
    }
    await clear()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="items-center">
          {profile && (
            <LetterAvatar
              letter={profile.avatarLetter}
              color={profile.avatarColor}
              hasPurpleTick={profile.hasPurpleTick}
              size={96}
            />
          )}
          <Text className="mt-4 text-xl font-semibold">{profile?.displayHandle ?? '—'}</Text>
          <Text className="mt-1 text-sm text-muted">
            You interact anonymously within Mento.
          </Text>
        </View>

        <View className="mt-8 rounded-2xl bg-gray-50 p-4">
          <Row label="Role" value={user?.role ?? '—'} />
          <Row label="Account ID" value={user?.id ? user.id.slice(0, 8) : '—'} />
          <Row label="Joined" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'} />
        </View>

        <Pressable
          onPress={handleLogout}
          className="mt-8 rounded-md border border-gray-300 px-4 py-3 active:bg-gray-50"
        >
          <Text className="text-center text-base">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-b border-gray-100 py-3 last:border-b-0">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="mt-1 text-base">{value}</Text>
    </View>
  )
}
