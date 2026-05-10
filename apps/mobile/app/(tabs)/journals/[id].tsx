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
import { useLocalSearchParams } from 'expo-router'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'

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
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-muted">{error ?? 'Loading…'}</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          {journal.isShared && (
            <View
              className={`self-start rounded-full px-2 py-0.5 ${
                journal.isLocked
                  ? 'bg-gray-200'
                  : journal.canEdit
                    ? 'bg-emerald-100'
                    : 'bg-amber-100'
              }`}
            >
              <Text
                className={`text-xs ${
                  journal.isLocked
                    ? 'text-gray-700'
                    : journal.canEdit
                      ? 'text-emerald-700'
                      : 'text-amber-800'
                }`}
              >
                {journal.isLocked
                  ? 'Locked'
                  : journal.canEdit
                    ? 'Active — both online'
                    : 'Read-only — only one of you here'}
              </Text>
            </View>
          )}

          {journal.entries.length === 0 ? (
            <View className="rounded-2xl bg-gray-50 p-6">
              <Text className="text-center text-sm text-muted">
                {journal.canEdit
                  ? 'No entries yet. Start writing below.'
                  : 'Waiting for both of you to be active.'}
              </Text>
            </View>
          ) : (
            journal.entries.map((e) => (
              <View key={e.id} className="rounded-2xl border border-gray-200 bg-white p-4">
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
                <Text className="text-sm">{e.content}</Text>
              </View>
            ))
          )}
        </ScrollView>

        {journal.canEdit && (
          <View className="border-t border-gray-100 p-3 gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder="Write a reflection…"
              className="min-h-[60px] rounded-md border border-gray-200 bg-white p-3 text-base"
            />
            <Pressable
              onPress={add}
              disabled={!draft.trim() || busy}
              className={`rounded-md px-4 py-3 ${
                !draft.trim() || busy ? 'bg-gray-300' : 'bg-primary'
              }`}
            >
              <Text className="text-center text-base font-medium text-white">
                {busy ? 'Saving…' : 'Add entry'}
              </Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
