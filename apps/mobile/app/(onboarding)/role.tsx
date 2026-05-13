import { useEffect, useState } from 'react'
import { Pressable, SafeAreaView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { GraduationCap, Star } from 'lucide-react-native'
import { COPY } from '@/lib/copy'
import { getApiClient } from '@/lib/api'
import { getSessionId } from '@/lib/session-id'
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

export default function RolePick() {
  const [busy, setBusy] = useState<'ASPIRANT' | 'MENTOR' | null>(null)

  useEffect(() => {
    capture(ANALYTICS_EVENTS.ROLE_PICK_VIEWED)
  }, [])

  async function pick(role: 'ASPIRANT' | 'MENTOR') {
    capture(ANALYTICS_EVENTS.ROLE_PICK_SELECTED, { role })
    setBusy(role)
    try {
      const sid = await getSessionId()
      await getApiClient().onboarding.pickRole(sid, role).catch(() => {})
    } finally {
      router.push(role === 'ASPIRANT' ? '/(onboarding)/welcome' : '/(onboarding)/mentor-welcome')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-6">
        {/* Back */}
        <Pressable
          onPress={() => router.back()}
          className="mb-8 self-start"
          hitSlop={12}
        >
          <Text className="text-sm text-muted">← Back</Text>
        </Pressable>

        {/* Header */}
        <View className="mb-10 items-center">
          <Text className="text-3xl font-bold tracking-tight text-foreground">Mento</Text>
          <Text className="mt-2 text-sm text-muted">{COPY.honourStruggle}</Text>
        </View>

        <View className="gap-4">
          {/* Aspirant card */}
          <Pressable
            disabled={busy !== null}
            onPress={() => pick('ASPIRANT')}
            className="overflow-hidden rounded-2xl"
          >
            <LinearGradient
              colors={['#dbeafe', '#eff6ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#bfdbfe' }}
            >
              <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                <GraduationCap size={24} color="#1d4ed8" strokeWidth={2} />
              </View>
              <Text className="text-lg font-semibold text-foreground">I'm preparing for UPSC</Text>
              <Text className="mt-1.5 text-sm leading-relaxed text-muted">
                Find guidance from someone who's walked your path.
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Mentor card */}
          <Pressable
            disabled={busy !== null}
            onPress={() => pick('MENTOR')}
            className="overflow-hidden rounded-2xl"
          >
            <LinearGradient
              colors={['#ede9fe', '#f5f3ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#ddd6fe' }}
            >
              <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                <Star size={24} color="#6d28d9" strokeWidth={2} />
              </View>
              <Text className="text-lg font-semibold text-foreground">I'd like to mentor</Text>
              <Text className="mt-1.5 text-sm leading-relaxed text-muted">
                You've cleared at least one Prelims. Help someone navigate it.
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        <Text className="mt-8 text-center text-xs text-muted">
          You can be both later. Pick what brought you here.
        </Text>
      </View>
    </SafeAreaView>
  )
}
