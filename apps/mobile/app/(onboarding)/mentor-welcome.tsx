import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { COPY } from '@/lib/copy'

export default function MentorWelcome() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
        <Text className="text-2xl font-bold tracking-tight">Thank you for being here.</Text>
        <Text className="mt-4 text-base leading-relaxed text-muted">{COPY.mentorPhilosophy}</Text>
        <Text className="mt-3 text-sm leading-relaxed text-muted">{COPY.mentorAnonymity}</Text>
        <Text className="mt-3 text-sm leading-relaxed text-muted">{COPY.mentorSelfProtect}</Text>

        <Pressable
          onPress={() => router.replace('/(auth)/login?role=MENTOR')}
          className="mt-8 rounded-md bg-primary px-4 py-3"
        >
          <View>
            <Text className="text-center text-base font-medium text-white">Continue</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
