'use client'

import { motion } from 'framer-motion'

interface MotionFadeProps {
  children: React.ReactNode
  className?: string
  /** Delay in seconds before the animation starts */
  delay?: number
}

/**
 * Fades in + slides up 12px on mount.
 * Exits with a fade + slide down.
 * Use for section enters and card reveals.
 */
export function MotionFade({ children, className, delay = 0 }: MotionFadeProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}
