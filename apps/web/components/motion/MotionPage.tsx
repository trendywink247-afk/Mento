'use client'

import { motion } from 'framer-motion'

interface MotionPageProps {
  children: React.ReactNode
  className?: string
}

/**
 * Page-level wrapper. Fades in + slides up 8px on mount.
 * Wrap the root div of any page component with this.
 */
export function MotionPage({ children, className }: MotionPageProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
