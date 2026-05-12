import { Tabs } from 'expo-router'
import { BookOpen, LayoutDashboard, MessageSquare, User, UserCheck, Users } from 'lucide-react-native'
import { useAuthStore } from '@/lib/auth-store'

const PRIMARY = '#2563eb'
const MUTED = '#94a3b8'

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user)
  const isMentor = user?.role === 'MENTOR'

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          borderTopColor: '#e2e8f0',
          backgroundColor: '#ffffff',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <LayoutDashboard size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="journals"
        options={{
          title: 'Journals',
          tabBarIcon: ({ focused, color }) => (
            <BookOpen size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused, color }) => (
            <MessageSquare size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      {/* Mentor tab: Mentees | Aspirant tab: Mentors */}
      <Tabs.Screen
        name="mentees"
        options={{
          title: 'Mentees',
          href: isMentor ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <UserCheck size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="mentors"
        options={{
          title: 'Mentors',
          href: isMentor ? null : undefined,
          tabBarIcon: ({ focused, color }) => (
            <Users size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <User size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
    </Tabs>
  )
}
