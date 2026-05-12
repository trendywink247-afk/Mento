'use client'

// 5-step segmented control replacing the native <input type="range">.
// The value prop and onChange signature are unchanged (0..1 float) so the
// API payload shape stays identical. Steps map to: 0 / 0.25 / 0.5 / 0.75 / 1.0

const STEPS: { value: number; label: string }[] = [
  { value: 0,    label: "Haven't opened the book" },
  { value: 0.25, label: 'Read once' },
  { value: 0.5,  label: 'Some grasp' },
  { value: 0.75, label: 'Comfortable' },
  { value: 1,    label: 'Could teach this' },
]

interface Props {
  label: string
  value: number // 0..1
  onChange: (v: number) => void
}

export function ConfidenceSlider({ label, value, onChange }: Props) {
  // Find which step index is closest to the current value.
  // When value === 0 and no step has been chosen yet, activeIdx is 0 but we
  // treat it as "unpicked" so no segment is lit — forces active engagement.
  const activeIdx = STEPS.reduce(
    (best, step, i) =>
      Math.abs(step.value - value) < Math.abs(STEPS[best]!.value - value) ? i : best,
    0,
  )
  const isPicked = value !== 0

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {isPicked ? STEPS[activeIdx]?.label : 'Not rated'}
        </span>
      </div>
      <div className="flex gap-1" role="group" aria-label={`${label} confidence level`}>
        {STEPS.map((step, i) => {
          const isActive = isPicked && i === activeIdx
          const isLit = isPicked && i <= activeIdx
          return (
            <button
              key={step.value}
              type="button"
              onClick={() => onChange(step.value)}
              title={step.label}
              aria-label={`${label}: ${step.label}`}
              aria-pressed={isActive}
              className={`h-8 flex-1 rounded text-xs font-medium transition-all ${
                isLit
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-input bg-background text-muted-foreground hover:bg-accent'
              } ${isActive ? 'ring-2 ring-primary ring-offset-1' : ''}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
