import { SafeAreaView, Text, View } from 'react-native'
import { useAuthStore } from '@/lib/auth-store'
import { LetterAvatar } from '@/components/LetterAvatar'

export default function Home() {
  const { user, profile } = useAuthStore()
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-6">
        <Text className="text-3xl font-bold tracking-tight text-primary">Welcome</Text>
        <Text className="mt-2 text-base text-muted">Your journey is yours alone.</Text>

        <View className="mt-8 flex-row items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          {profile && (
            <LetterAvatar
              letter={profile.avatarLetter}
              color={profile.avatarColor}
              hasPurpleTick={profile.hasPurpleTick}
              size={56}
            />
          )}
          <View className="flex-1">
            <Text className="text-base font-medium">{profile?.displayHandle ?? '—'}</Text>
            <Text className="mt-1 text-xs text-muted">{user?.role}</Text>
          </View>
        </View>

        <View className="mt-6 rounded-2xl bg-gray-50 p-4">
          <Text className="text-sm text-muted">
            Open Chats to see your conversations. The Mirror will appear here once onboarding lands.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
