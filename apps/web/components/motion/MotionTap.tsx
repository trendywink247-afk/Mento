'use client'

import { motion } from 'framer-motion'

interface MotionTapProps {
  children: React.ReactNode
  className?: string
  /** Disable hover/tap effects (e.g. when button is disabled) */
  disabled?: boolean
}

/**
 * Wraps any button-like child.
 * Applies whileTap scale-down + whileHover scale-up.
 * Use on all primary CTAs, role cards, and interactive tiles.
 */
export function MotionTap({ children, className, disabled = false }: MotionTapProps) {
  return (
    <motion.div
      className={className}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
