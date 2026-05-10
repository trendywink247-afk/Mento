import { Pressable, Text, View } from 'react-native'

// Lightweight discrete-step slider (avoids extra deps). 5 levels.
// 0.0 → 'No idea', 0.25, 0.5, 0.75, 1.0 → 'Strong'.

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
}

const STEPS = [0, 0.25, 0.5, 0.75, 1]
const LABELS = ['No idea', 'Just started', 'Some grasp', 'Comfortable', 'Strong']

export function ConfidenceSlider({ label, value, onChange }: Props) {
  const idx = STEPS.findIndex((s) => Math.abs(s - value) < 0.01)
  const active = idx >= 0 ? idx : 0
  return (
    <View>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm font-medium">{label}</Text>
        <Text className="text-xs text-muted">{LABELS[active]}</Text>
      </View>
      <View className="mt-2 flex-row gap-1">
        {STEPS.map((s, i) => (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
            className={`h-3 flex-1 rounded-full ${i <= active ? 'bg-primary' : 'bg-gray-200'}`}
          />
        ))}
      </View>
    </View>
  )
}
