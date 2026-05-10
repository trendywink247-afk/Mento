import { useState } from 'react'
import { Pressable, SafeAreaView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { COPY } from '@/lib/copy'
import { getApiClient } from '@/lib/api'
import { getSessionId } from '@/lib/session-id'

export default function RolePick() {
  const [busy, setBusy] = useState<'ASPIRANT' | 'MENTOR' | null>(null)

  async function pick(role: 'ASPIRANT' | 'MENTOR') {
    setBusy(role)
    try {
      const sid = await getSessionId()
      await getApiClient().onboarding.pickRole(sid, role).catch(() => {})
    } finally {
      router.push(role === 'ASPIRANT' ? '/(onboarding)/welcome' : '/(onboarding)/mentor-welcome')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center px-6">
        <View className="mb-10 items-center">
          <Text className="text-3xl font-bold tracking-tight">Mento</Text>
          <Text className="mt-2 text-sm text-muted">{COPY.honourStruggle}</Text>
        </View>

        <View className="gap-3">
          <Pressable
            disabled={busy !== null}
            onPress={() => pick('ASPIRANT')}
            className="rounded-2xl border border-gray-200 bg-white p-5 active:bg-gray-50"
          >
            <Text className="text-base font-medium">I'm preparing for UPSC</Text>
            <Text className="mt-1 text-xs text-muted">
              Find guidance from someone who's walked your path.
            </Text>
          </Pressable>
          <Pressable
            disabled={busy !== null}
            onPress={() => pick('MENTOR')}
            className="rounded-2xl border border-gray-200 bg-white p-5 active:bg-gray-50"
          >
            <Text className="text-base font-medium">I'd like to mentor</Text>
            <Text className="mt-1 text-xs text-muted">
              You've cleared at least one Prelims. Help someone navigate it.
            </Text>
          </Pressable>
        </View>

        <Text className="mt-8 text-center text-xs text-muted">
          You can be both later. Pick what brought you here.
        </Text>
      </View>
    </SafeAreaView>
  )
}
