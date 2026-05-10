import { Pressable, SafeAreaView, Text, View } from 'react-native'
import { router } from 'expo-router'

export default function Submitted() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-6">
        <View className="max-w-md gap-4 text-center">
          <Text className="text-center text-2xl font-bold tracking-tight">Thank you.</Text>
          <Text className="text-center text-sm leading-relaxed text-muted">
            Our team will review your details and verify your account within 1-2 business days.
            You will see your Mentor profile activate when verification completes.
          </Text>
          <Text className="text-center text-sm leading-relaxed text-muted">
            We honour the time you've given to this preparation.
          </Text>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            className="mt-4 rounded-md border border-gray-300 px-4 py-3"
          >
            <Text className="text-center text-base">Go to home</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}
