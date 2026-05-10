import { Stack } from 'expo-router'

export default function MentorsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Mentors', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Mentor' }} />
    </Stack>
  )
}
