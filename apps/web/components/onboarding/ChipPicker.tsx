'use client'

interface Props {
  options: readonly string[] | readonly { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  multi?: boolean
  /** Show a live count badge: "{n} selected · pick at least 1" */
  showCount?: boolean
  /** Force a 3-column grid on md+ screens for visual rhythm */
  gridCols?: boolean
}

export function ChipPicker({
  options,
  selected,
  onChange,
  multi = true,
  showCount = false,
  gridCols = false,
}: Props) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

  function toggle(v: string) {
    if (selected.includes(v)) {
      onChange(selected.filter((x) => x !== v))
    } else {
      onChange(multi ? [...selected, v] : [v])
    }
  }

  return (
    <div className="space-y-2">
      {showCount && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {selected.length > 0
            ? `${selected.length} selected · pick at least 1`
            : 'Pick at least 1'}
        </p>
      )}
      <div
        className={
          gridCols
            ? 'grid grid-cols-2 gap-2 md:grid-cols-3'
            : 'flex flex-wrap gap-2'
        }
      >
        {opts.map((o) => {
          const active = selected.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
