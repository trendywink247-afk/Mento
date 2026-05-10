import { Pressable, Text, View } from 'react-native'

interface Props {
  options: readonly string[] | readonly { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  multi?: boolean
}

export function ChipPicker({ options, selected, onChange, multi = true }: Props) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  function toggle(v: string) {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v))
    else onChange(multi ? [...selected, v] : [v])
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {opts.map((o) => {
        const active = selected.includes(o.value)
        return (
          <Pressable
            key={o.value}
            onPress={() => toggle(o.value)}
            className={`rounded-full border px-3 py-1.5 ${
              active ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
            }`}
          >
            <Text className={active ? 'text-sm text-white' : 'text-sm'}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
