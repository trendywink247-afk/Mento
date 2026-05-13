import { useCallback, useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Lock, Unlock, ChevronLeft } from 'lucide-react-native'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

type Detail = {
  id: string
  category: string
  isShared: boolean
  isLocked: boolean
  canEdit: boolean
  entries: Array<{
    id: string
    type: string
    content: string
    createdAt: string
    author: {
      id: string
      displayHandle: string
      avatarLetter: AvatarLetter
      avatarColor: AvatarColor
    }
  }>
}

function humanCategory(raw: string): string {
  return raw
    .replace(/^(PRELIMS|MAINS)_/, (_, prefix) => prefix.charAt(0) + prefix.slice(1).toLowerCase() + ' — ')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function JournalScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const [journal, setJournal] = useState<Detail | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!params.id) return
    try {
      const j = await getApiClient().journals.detail(String(params.id))
      setJournal(j as Detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }, [params.id])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    if (!journal || !draft.trim()) return
    setBusy(true)
    try {
      await getApiClient().journals.addEntry(journal.id, draft.trim())
      capture(ANALYTICS_EVENTS.JOURNAL_ENTRY_CREATED, { category: journal.category })
      setDraft('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  if (!journal) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-muted">{error ?? 'Loading…'}</Text>
      </SafeAreaView>
    )
  }

  const statusBg = journal.isLocked
    ? '#f1f5f9'
    : journal.canEdit
    ? '#ecfdf5'
    : '#fffbeb'

  const statusText = journal.isLocked
    ? 'Locked'
    : journal.canEdit
    ? 'Active — both online'
    : 'Read-only — only one of you here'

  const StatusIcon = journal.isLocked ? Lock : Unlock

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Breadcrumb */}
        <View className="flex-row items-center gap-2 border-b border-border px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8} className="flex-row items-center gap-1">
            <ChevronLeft size={16} color="#64748b" strokeWidth={2} />
            <Text className="text-sm text-muted">Journals</Text>
          </Pressable>
          <Text className="text-sm text-muted">/</Text>
          <Text className="text-sm font-medium text-foreground">{humanCategory(journal.category)}</Text>
        </View>

        {/* Status banner */}
        {journal.isShared && (
          <View
            style={{ backgroundColor: statusBg }}
            className="flex-row items-center gap-2 px-4 py-2.5"
          >
            <StatusIcon
              size={13}
              color={journal.isLocked ? '#64748b' : journal.canEdit ? '#065f46' : '#b45309'}
              strokeWidth={2}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: journal.isLocked ? '#64748b' : journal.canEdit ? '#065f46' : '#b45309',
              }}
            >
              {statusText}
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          {journal.entries.length === 0 ? (
            <View className="rounded-2xl bg-accent p-6">
              <Text className="text-center text-sm text-muted">
                {journal.canEdit
                  ? 'No entries yet. Start writing below.'
                  : 'Waiting for both of you to be active.'}
              </Text>
            </View>
          ) : (
            journal.entries.map((e) => (
              <View key={e.id} className="rounded-2xl border border-border bg-white p-4">
                <View className="mb-2 flex-row items-center gap-2">
                  <LetterAvatar
                    letter={e.author.avatarLetter}
                    color={e.author.avatarColor}
                    size={24}
                  />
                  <Text className="text-xs text-muted">
                    {e.author.displayHandle} · {new Date(e.createdAt).toLocaleString()}
                  </Text>
                </View>
                <Text className="text-sm text-foreground">{e.content}</Text>
              </View>
            ))
          )}
        </ScrollView>

        {journal.canEdit && (
          <View className="gap-2 border-t border-border p-3">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder="Write a reflection…"
              placeholderTextColor="#94a3b8"
              className="min-h-[60px] rounded-xl border border-border bg-white p-3 text-base text-foreground"
            />
            {error && <Text className="text-xs text-destructive">{error}</Text>}
            <Pressable
              onPress={add}
              disabled={!draft.trim() || busy}
              className={`rounded-xl px-4 py-3 ${
                !draft.trim() || busy ? 'bg-border' : 'bg-primary'
              }`}
            >
              <Text className="text-center text-base font-semibold text-white">
                {busy ? 'Saving…' : 'Add entry'}
              </Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
