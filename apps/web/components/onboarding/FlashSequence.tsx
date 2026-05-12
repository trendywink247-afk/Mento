'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  lines: readonly string[]
  msPerLine?: number
  fadeMs?: number
  onDone?: () => void
  onSkip?: () => void
}

export function FlashSequence({
  lines,
  msPerLine = 900,
  fadeMs = 300,
  onDone,
  onSkip,
}: Props) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const advancingRef = useRef(false)

  const advance = useCallback(() => {
    if (advancingRef.current) return
    advancingRef.current = true
    setVisible(false)
    setTimeout(() => {
      setIdx((prev) => {
        const next = prev + 1
        if (next >= lines.length) {
          onDone?.()
          return prev
        }
        advancingRef.current = false
        setVisible(true)
        return next
      })
    }, fadeMs)
  }, [fadeMs, lines.length, onDone])

  // Auto-advance timer resets on every idx change
  useEffect(() => {
    if (idx >= lines.length) return
    const fadeOutAt = msPerLine - fadeMs
    const fadeOut = setTimeout(() => setVisible(false), fadeOutAt)
    const next = setTimeout(() => {
      advancingRef.current = false
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
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-8"
      style={{ background: 'var(--background)' }}
      onClick={advance}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') advance()
      }}
      aria-label="Flash introduction. Click or tap to advance."
    >
      {/* ── Animated background layer ── */}
      {/* Slow-rotating conic gradient overlay */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(147,197,253,0.07) 60deg, transparent 120deg, rgba(167,139,250,0.06) 180deg, transparent 240deg, rgba(147,197,253,0.05) 300deg, transparent 360deg)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, ease: 'linear', repeat: Infinity }}
      />

      {/* Blob 1 — blue tint, upper-left drift */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute h-80 w-80 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(147,197,253,0.18) 0%, transparent 70%)',
          top: '10%',
          left: '5%',
        }}
        animate={{ x: [-60, 80, -60], y: [-30, 50, -30] }}
        transition={{ duration: 35, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Blob 2 — violet tint, lower-right drift */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute h-96 w-96 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(167,139,250,0.14) 0%, transparent 70%)',
          bottom: '8%',
          right: '3%',
        }}
        animate={{ x: [60, -80, 60], y: [30, -60, 30] }}
        transition={{ duration: 40, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* ── Mento wordmark (faded) ── */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-6 top-6 select-none text-sm font-semibold tracking-widest text-foreground"
        style={{ opacity: 0.4 }}
      >
        Mento
      </span>

      {/* Skip button — stopPropagation so the outer click handler does not also fire */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSkip?.()
        }}
        className="absolute right-6 top-6 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label="Skip introduction"
      >
        Skip intro &rarr;
      </button>

      {/* Current line with aria-live so screen readers announce each phrase */}
      <section
        role="region"
        aria-live="polite"
        aria-label="Introduction phrase"
        className="relative z-10 flex flex-col items-center"
      >
        <p
          key={idx}
          className="max-w-xl text-center text-2xl font-medium tracking-tight transition-opacity"
          style={{ opacity: visible ? 1 : 0, transitionDuration: `${fadeMs}ms` }}
        >
          {lines[idx]}
        </p>
      </section>

      {/* Dot progress strip */}
      <div
        className="absolute bottom-10 z-10 flex items-center gap-2"
        aria-hidden="true"
        role="presentation"
      >
        {lines.map((_, i) => (
          <span
            key={i}
            className={`inline-block rounded-full transition-all duration-300 ${
              i === idx
                ? 'h-2 w-4 bg-foreground'
                : i < idx
                  ? 'h-1.5 w-1.5 bg-foreground/40'
                  : 'h-1.5 w-1.5 bg-foreground/20'
            }`}
          />
        ))}
      </div>

      <p className="absolute bottom-5 z-10 text-xs text-muted-foreground/50" aria-hidden="true">
        Tap anywhere to advance
      </p>
    </div>
  )
}
