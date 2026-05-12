import { useEffect, useState } from 'react'
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { PenLine, Users, BookOpen, MessageSquare, ArrowRight } from 'lucide-react-native'
import { useAuthStore } from '@/lib/auth-store'
import { LetterAvatar } from '@/components/LetterAvatar'
import { getApiClient } from '@/lib/api'

// ─── Static data ──────────────────────────────────────────────────────────────

const DAILY_PROMPTS = [
  "What's the one thing you're avoiding studying? Why?",
  'If you had to explain Federalism to a 10-year-old today, what would you say?',
  "What's your biggest fear about this attempt?",
  'Write down 3 things you understood well this week and 1 that still feels blurry.',
  "Which subject feels like a wall right now? What's one crack in it?",
  'If you had unlimited time today, how would you spend it studying?',
  'What does success feel like to you — not rank, but the feeling?',
]

const SAMPLE_QUESTIONS = [
  'How relevant is reading the newspaper for Prelims?',
  'How should I plan my first 6 months of preparation?',
  'Did you struggle with Mains writing speed? What helped?',
  'How did you handle the emotional dip after a failed Prelims?',
  'Coaching or self-study — when does each make sense?',
  'What single book or source had the biggest impact for you?',
]

function getTodayPrompt(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  )
  return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length]!
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingState {
  mirrorComplete: boolean
  nextStep: string | null
}

interface ConversationSummary {
  id: string
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function Home() {
  const { user, profile } = useAuthStore()
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const api = getApiClient()
    Promise.all([
      api.onboarding.state().catch(() => null),
      api.chat.listConversations().catch(() => []),
    ]).then(([obs, convos]) => {
      setOnboarding(obs as OnboardingState | null)
      setConversations(convos as ConversationSummary[])
      setLoading(false)
    })
  }, [])

  const displayHandle = profile?.displayHandle ?? 'there'
  const isMirrorComplete = onboarding?.mirrorComplete ?? false
  const isAspirant = user?.role === 'ASPIRANT'
  const conversationCount = conversations?.length ?? 0
  const todayPrompt = getTodayPrompt()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24, gap: 24 }}>

        {/* Welcome */}
        <View className="flex-row items-center gap-3">
          {profile && (
            <LetterAvatar
              letter={profile.avatarLetter}
              color={profile.avatarColor}
              hasPurpleTick={profile.hasPurpleTick}
              size={44}
            />
          )}
          <View className="flex-1">
            <Text className="text-2xl font-bold tracking-tight text-foreground">
              Hey, {displayHandle}
            </Text>
            <Text className="text-sm text-muted">Your journey is yours alone.</Text>
          </View>
        </View>

        {/* Today's reflection */}
        <View className="rounded-2xl border border-border bg-primary/5 p-5">
          <View className="mb-2 flex-row items-center gap-1.5">
            <PenLine size={13} color="#2563eb" strokeWidth={2.5} />
            <Text className="text-xs font-semibold uppercase tracking-wider text-primary">
              Today's Reflection
            </Text>
          </View>
          <Text className="mt-1 text-base font-medium text-foreground">{todayPrompt}</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/journals')}
            className="mt-4 self-start flex-row items-center gap-1.5 rounded-lg bg-primary px-4 py-2"
          >
            <Text className="text-sm font-medium text-white">Open Personal Journal</Text>
            <ArrowRight size={14} color="#ffffff" />
          </Pressable>
        </View>

        {/* 3 next-step cards */}
        <View className="gap-3">
          {/* Card A — Find a mentor */}
          <Pressable
            onPress={() => router.push('/(tabs)/mentors')}
            className="rounded-2xl border border-border bg-accent p-5"
          >
            <View className="mb-3 h-10 w-10 items-center justify-center rounded-full bg-border">
              <Users size={20} color="#64748b" />
            </View>
            <Text className="text-base font-semibold text-foreground">Find a Mentor</Text>
            <Text className="mt-1 text-sm text-muted">
              Browse verified mentors who've walked the UPSC path.
            </Text>
            <View className="mt-3 flex-row items-center gap-1">
              <Text className="text-sm font-medium text-primary">Browse mentors</Text>
              <ArrowRight size={13} color="#2563eb" />
            </View>
          </Pressable>

          {/* Card B — Mirror status */}
          {loading ? null : isMirrorComplete ? (
            <Pressable
              onPress={() => router.push('/(onboarding)/mirror')}
              className="rounded-2xl border border-border p-5"
              style={{ backgroundColor: '#f5f3ff' }}
            >
              <View
                className="mb-3 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: '#ddd6fe' }}
              >
                <BookOpen size={20} color="#5b21b6" />
              </View>
              <Text className="text-base font-semibold text-foreground">Mirror complete</Text>
              <Text className="mt-1 text-sm text-muted">
                Your prep profile is saved. You can update it any time.
              </Text>
              <View className="mt-3 flex-row items-center gap-1">
                <Text className="text-sm font-medium" style={{ color: '#7c3aed' }}>
                  Update Mirror
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/(onboarding)/mirror')}
              className="rounded-2xl border border-border p-5"
              style={{ backgroundColor: '#fffbeb' }}
            >
              <View
                className="mb-3 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: '#fde68a' }}
              >
                <BookOpen size={20} color="#92400e" />
              </View>
              <Text className="text-base font-semibold text-foreground">Complete the Mirror</Text>
              <Text className="mt-1 text-sm text-muted">
                A self-reflection that helps mentors understand you without revealing your identity.
              </Text>
              <View className="mt-3 flex-row items-center gap-1">
                <Text className="text-sm font-medium" style={{ color: '#b45309' }}>
                  Start Mirror
                </Text>
                <ArrowRight size={13} color="#b45309" />
              </View>
            </Pressable>
          )}

          {/* Card C — Conversations */}
          <Pressable
            onPress={() => router.push(conversationCount > 0 ? '/(tabs)/chat' : '/(tabs)/mentors')}
            className="rounded-2xl border border-border p-5"
            style={{ backgroundColor: '#ecfdf5' }}
          >
            <View
              className="mb-3 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: '#a7f3d0' }}
            >
              <MessageSquare size={20} color="#065f46" />
            </View>
            <Text className="text-base font-semibold text-foreground">
              {conversationCount > 0
                ? `${conversationCount} Conversation${conversationCount > 1 ? 's' : ''}`
                : 'No conversations yet'}
            </Text>
            <Text className="mt-1 text-sm text-muted">
              {conversationCount > 0
                ? 'Continue a meaningful conversation with your mentor.'
                : 'Send a 160-character intro to start chatting with a mentor.'}
            </Text>
            <View className="mt-3 flex-row items-center gap-1">
              <Text className="text-sm font-medium" style={{ color: '#065f46' }}>
                {conversationCount > 0 ? 'Open chats' : 'Browse mentors'}
              </Text>
              <ArrowRight size={13} color="#065f46" />
            </View>
          </Pressable>
        </View>

        {/* Sample questions — aspirants with complete Mirror */}
        {!loading && isMirrorComplete && isAspirant && (
          <View>
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Questions to ask your mentor
            </Text>
            <View className="rounded-2xl border border-border overflow-hidden">
              {SAMPLE_QUESTIONS.map((q, idx) => (
                <Pressable
                  key={q}
                  onPress={() => router.push('/(tabs)/mentors')}
                  className={`flex-row items-center justify-between px-4 py-3.5 ${
                    idx < SAMPLE_QUESTIONS.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <Text className="flex-1 text-sm text-foreground">{q}</Text>
                  <Text className="ml-3 flex-shrink-0 text-xs text-muted">Send →</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
