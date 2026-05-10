'use client'

interface Props {
  label: string
  value: number // 0..1
  onChange: (v: number) => void
}

export function ConfidenceSlider({ label, value, onChange }: Props) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{labelFor(value)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full"
      />
    </div>
  )
}

function labelFor(v: number): string {
  if (v < 0.2) return 'No idea'
  if (v < 0.4) return 'Just started'
  if (v < 0.6) return 'Some grasp'
  if (v < 0.8) return 'Comfortable'
  return 'Strong'
}
