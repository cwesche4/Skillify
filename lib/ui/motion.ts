'use client'

// Motion specs for Inspector (snappy open, tighter close)
export const INSPECTOR_OPEN_MS = 240
export const INSPECTOR_CLOSE_MS = 200

export type MotionEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | [number, number, number, number]

// NOTE:
// Framer Motion does NOT accept CSS `cubic-bezier()` strings.
// Always use tuple-based bezier definitions or named easings.
export const INSPECTOR_EASE_OUT: MotionEasing = [0.16, 1, 0.3, 1]
export const INSPECTOR_EASE_IN: MotionEasing = [0.7, 0, 0.84, 0]

// Prefer reduced motion by skipping transforms;
// consumers should gate on prefers-reduced-motion.
