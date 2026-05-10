import { Stack } from 'expo-router'

export default function ChatStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Chat', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Conversation' }} />
    </Stack>
  )
}
