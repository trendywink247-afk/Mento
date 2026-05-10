import { Stack } from 'expo-router'

export default function JournalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Journals', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Journal' }} />
    </Stack>
  )
}
