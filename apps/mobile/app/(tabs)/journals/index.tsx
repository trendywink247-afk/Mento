import { useEffect, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import {
  Lock,
  ScrollText,
  BookMarked,
  Globe,
  GraduationCap,
  Scale,
  PenLine,
  Newspaper,
  Calculator,
  TreePine,
  Cpu,
  FileText,
  Map,
  Landmark,
  TrendingUp,
  Mic,
  type LucideIcon,
} from 'lucide-react-native'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

// ─── Category icon map ────────────────────────────────────────────────────────

const MUTED = '#64748b'
const PRIMARY = '#2563eb'

const ICON_MAP: Record<string, LucideIcon> = {
  PERSONAL: Lock,
  PRELIMS_POLITY: Landmark,
  PRELIMS_HISTORY: BookMarked,
  PRELIMS_GEOGRAPHY: Map,
  PRELIMS_ECONOMY: TrendingUp,
  PRELIMS_ENVIRONMENT: TreePine,
  PRELIMS_SCI_TECH: Cpu,
  PRELIMS_CSAT: Calculator,
  PRELIMS_CURRENT_AFFAIRS: Newspaper,
  MAINS_GS1: ScrollText,
  MAINS_GS2: Scale,
  MAINS_GS3: Globe,
  MAINS_GS4: PenLine,
  MAINS_ESSAY: FileText,
  MAINS_OPTIONAL: GraduationCap,
  INTERVIEW: Mic,
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Personal', items: [{ key: 'PERSONAL', name: 'Personal' }] },
  {
    label: 'Prelims',
    items: [
      { key: 'PRELIMS_POLITY', name: 'Polity' },
      { key: 'PRELIMS_HISTORY', name: 'History' },
      { key: 'PRELIMS_GEOGRAPHY', name: 'Geography' },
      { key: 'PRELIMS_ECONOMY', name: 'Economy' },
      { key: 'PRELIMS_ENVIRONMENT', name: 'Environment' },
      { key: 'PRELIMS_SCI_TECH', name: 'Sci-Tech' },
      { key: 'PRELIMS_CSAT', name: 'CSAT' },
      { key: 'PRELIMS_CURRENT_AFFAIRS', name: 'Current Affairs' },
    ],
  },
  {
    label: 'Mains',
    items: [
      { key: 'MAINS_GS1', name: 'GS1' },
      { key: 'MAINS_GS2', name: 'GS2' },
      { key: 'MAINS_GS3', name: 'GS3' },
      { key: 'MAINS_GS4', name: 'GS4' },
      { key: 'MAINS_ESSAY', name: 'Essay' },
      { key: 'MAINS_OPTIONAL', name: 'Optional' },
    ],
  },
  { label: 'Interview', items: [{ key: 'INTERVIEW', name: 'Interview' }] },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

type Existing = {
  id: string
  category: string
  isShared: boolean
  isLocked: boolean
  entryCount: number
  updatedAt?: string
  sharedWith: {
    id: string
    displayHandle: string
    avatarLetter: AvatarLetter
    avatarColor: AvatarColor
  } | null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'Updated just now'
  if (hours < 24) return `Updated ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `Updated ${days}d ago`
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function JournalsList() {
  const [existing, setExisting] = useState<Existing[]>([])

  useEffect(() => {
    capture(ANALYTICS_EVENTS.JOURNAL_LIST_VIEWED)
    getApiClient()
      .journals.list()
      .then((rows) => setExisting(rows as Existing[]))
      .catch(() => {})
  }, [])

  async function open(category: string) {
    capture(ANALYTICS_EVENTS.JOURNAL_OPENED, { category })
    const j = await getApiClient().journals.upsert(category)
    router.push({ pathname: '/(tabs)/journals/[id]', params: { id: j.id } })
  }

  const sharedJournals = existing.filter((j) => j.isShared)
  const totalEntries = existing.reduce((s, j) => s + j.entryCount, 0)

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
        {/* Header */}
        <View>
          <Text className="text-2xl font-bold tracking-tight text-foreground">Journals</Text>
          <Text className="mt-1 text-sm text-muted">
            Reflect privately, or together with a mentor.
          </Text>
          {totalEntries > 0 && (
            <View className="mt-2 self-start rounded-full bg-primary/10 px-3 py-1">
              <Text className="text-xs font-medium text-primary">{totalEntries} entries total</Text>
            </View>
          )}
        </View>

        {/* Shared journals */}
        {sharedJournals.length > 0 && (
          <View className="gap-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
              Shared with mentors
            </Text>
            {sharedJournals.map((j) => (
              <Pressable
                key={j.id}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/journals/[id]', params: { id: j.id } })
                }
                className="flex-row items-center gap-3 rounded-2xl border border-border bg-white p-4 active:bg-accent"
              >
                {j.sharedWith && (
                  <LetterAvatar
                    letter={j.sharedWith.avatarLetter}
                    color={j.sharedWith.avatarColor}
                    size={36}
                  />
                )}
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">
                    With {j.sharedWith?.displayHandle ?? '—'}
                  </Text>
                  <Text className="text-xs text-muted">
                    {j.entryCount} {j.entryCount === 1 ? 'entry' : 'entries'} ·{' '}
                    {j.isLocked ? 'Locked' : 'Active'}
                  </Text>
                </View>
                <View
                  className={`rounded-full px-2 py-0.5 ${
                    j.isLocked ? 'bg-gray-100' : 'bg-emerald-100'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-medium ${
                      j.isLocked ? 'text-gray-600' : 'text-emerald-700'
                    }`}
                  >
                    {j.isLocked ? 'Locked' : 'Active'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Category sections */}
        {CATEGORIES.map((g) => {
          const sectionEntries = g.items.reduce((sum, it) => {
            const found = existing.find((j) => j.category === it.key && !j.isShared)
            return sum + (found?.entryCount ?? 0)
          }, 0)

          return (
            <View key={g.label} className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {g.label}
                </Text>
                {sectionEntries > 0 && (
                  <View className="rounded-full bg-accent px-2 py-0.5">
                    <Text className="text-[10px] font-medium text-muted">{sectionEntries}</Text>
                  </View>
                )}
              </View>

              <View className="flex-row flex-wrap gap-2">
                {g.items.map((it) => {
                  const exists = existing.find((j) => j.category === it.key && !j.isShared)
                  const IconComp = ICON_MAP[it.key] ?? BookMarked
                  return (
                    <Pressable
                      key={it.key}
                      onPress={() => open(it.key)}
                      className="min-w-[45%] flex-1 rounded-xl border border-border bg-white p-3 active:bg-accent"
                    >
                      <View className="mb-2 h-8 w-8 items-center justify-center rounded-lg bg-accent">
                        <IconComp
                          size={16}
                          color={exists && exists.entryCount > 0 ? PRIMARY : MUTED}
                          strokeWidth={1.8}
                        />
                      </View>
                      <Text className="text-sm font-medium text-foreground">{it.name}</Text>
                      <Text className="mt-0.5 text-xs text-muted">
                        {exists && exists.entryCount > 0
                          ? `${exists.entryCount} ${exists.entryCount === 1 ? 'entry' : 'entries'}`
                          : 'Start your first entry'}
                      </Text>
                      {exists?.updatedAt && exists.entryCount > 0 && (
                        <Text className="mt-0.5 text-[10px] text-muted">
                          {timeAgo(exists.updatedAt)}
                        </Text>
                      )}
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
