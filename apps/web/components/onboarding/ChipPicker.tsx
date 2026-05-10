'use client'

interface Props {
  options: readonly string[] | readonly { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  multi?: boolean
}

export function ChipPicker({ options, selected, onChange, multi = true }: Props) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

  function toggle(v: string) {
    if (selected.includes(v)) {
      onChange(selected.filter((x) => x !== v))
    } else {
      onChange(multi ? [...selected, v] : [v])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => {
        const active = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-accent'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
