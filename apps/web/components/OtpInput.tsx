'use client'

import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  onComplete: (value: string) => void
  disabled?: boolean
  hasError?: boolean
}

const CELL_COUNT = 6

export function OtpInput({ value, onChange, onComplete, disabled, hasError }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>(Array(CELL_COUNT).fill(null))

  // Derive per-cell chars from value string
  const cells = Array.from({ length: CELL_COUNT }, (_, i) => value[i] ?? '')

  function focusCell(index: number) {
    refs.current[index]?.focus()
  }

  function updateValue(nextCells: string[]) {
    const next = nextCells.join('')
    onChange(next)
    if (next.length === CELL_COUNT) {
      onComplete(next)
    }
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) return

    // Take only the last typed digit (handles browser autofill of single digit)
    const digit = raw[raw.length - 1]
    const nextCells = [...cells]
    nextCells[index] = digit
    updateValue(nextCells)

    // Advance focus
    if (index < CELL_COUNT - 1) {
      focusCell(index + 1)
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const nextCells = [...cells]
      if (nextCells[index]) {
        // Clear current cell
        nextCells[index] = ''
        updateValue(nextCells)
      } else if (index > 0) {
        // Move to previous cell and clear it
        nextCells[index - 1] = ''
        updateValue(nextCells)
        focusCell(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      focusCell(index - 1)
    } else if (e.key === 'ArrowRight' && index < CELL_COUNT - 1) {
      e.preventDefault()
      focusCell(index + 1)
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CELL_COUNT)
    if (!pasted) return
    const nextCells = Array.from({ length: CELL_COUNT }, (_, i) => pasted[i] ?? '')
    updateValue(nextCells)
    // Focus last filled cell or last cell
    const lastIdx = Math.min(pasted.length, CELL_COUNT - 1)
    focusCell(lastIdx)
  }

  function handleFocus(index: number) {
    // Select existing digit so typing replaces it
    refs.current[index]?.select()
  }

  const cellBase = [
    'h-12 w-11 rounded-lg border text-center text-2xl font-semibold',
    'bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
    'transition-all duration-100 caret-transparent select-none',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' ')

  const cellNormal = 'border-input'
  const cellFilled = 'border-primary/50 bg-primary/5'
  const cellError = 'border-destructive focus:ring-destructive'

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="One-time password input"
    >
      {Array.from({ length: CELL_COUNT }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={cells[i]}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of ${CELL_COUNT}`}
          aria-invalid={hasError}
          disabled={disabled}
          className={[
            cellBase,
            hasError ? cellError : cells[i] ? cellFilled : cellNormal,
          ].join(' ')}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(i)}
        />
      ))}
    </div>
  )
}
