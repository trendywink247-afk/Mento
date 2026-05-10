'use client'

import { useEffect, useState } from 'react'

interface Props {
  lines: readonly string[]
  msPerLine?: number
  fadeMs?: number
  onDone?: () => void
}

export function FlashSequence({
  lines,
  msPerLine = 1200,
  fadeMs = 400,
  onDone,
}: Props) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (idx >= lines.length) return
    const fadeOutAt = msPerLine - fadeMs
    const fadeOut = setTimeout(() => setVisible(false), fadeOutAt)
    const next = setTimeout(() => {
      if (idx + 1 < lines.length) {
        setIdx(idx + 1)
        setVisible(true)
      } else {
        onDone?.()
      }
    }, msPerLine)
    return () => {
      clearTimeout(fadeOut)
      clearTimeout(next)
    }
  }, [idx, lines, msPerLine, fadeMs, onDone])

  if (idx >= lines.length) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <p
        key={idx}
        className="max-w-xl text-center text-2xl font-medium tracking-tight transition-opacity"
        style={{ opacity: visible ? 1 : 0, transitionDuration: `${fadeMs}ms` }}
      >
        {lines[idx]}
      </p>
    </div>
  )
}
