import { Stack } from 'expo-router'

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="role" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="mentor-welcome" />
      <Stack.Screen name="mirror" />
      <Stack.Screen name="mentor" />
      <Stack.Screen name="submitted" />
    </Stack>
  )
}
