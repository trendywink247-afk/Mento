'use client'

import { motion } from 'framer-motion'

interface MotionStaggerProps {
  children: React.ReactNode
  className?: string
  /** Delay between each child in seconds (default 0.06) */
  staggerDelay?: number
  /** Initial delay before first child in seconds (default 0) */
  initialDelay?: number
}

const containerVariants = {
  hidden: {},
  visible: (staggerDelay: number) => ({
    transition: {
      staggerChildren: staggerDelay,
    },
  }),
}

const childVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
}

/**
 * Wraps children and staggers each child's mount animation by `staggerDelay`.
 * Each child must be a direct descendant — wrap in a single element if needed.
 * Use for lists, card grids, chip rows.
 */
export function MotionStagger({
  children,
  className,
  staggerDelay = 0.06,
  initialDelay = 0,
}: MotionStaggerProps) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      custom={staggerDelay}
      transition={{ delayChildren: initialDelay }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Individual stagger child — must be a direct child of <MotionStagger>.
 */
export function MotionStaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={childVariants}>
      {children}
    </motion.div>
  )
}
