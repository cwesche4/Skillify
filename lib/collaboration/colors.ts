'use client'

/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Deterministic cursor colors (no runtime mutation).
============================================================================ */

const PALETTE = [
  '#38bdf8', // cyan
  '#a78bfa', // violet
  '#f472b6', // pink
  '#fb923c', // orange
  '#34d399', // emerald
  '#facc15', // amber
  '#60a5fa', // blue
  '#f87171', // red
  '#4ade80', // green
  '#c084fc', // purple
  '#67e8f9', // teal
  '#fbbf24', // gold
]

function hash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function assignCursorColor(
  userId: string,
  salt: string | number = 0,
): string {
  const idx = (hash(userId) + hash(String(salt))) % PALETTE.length
  return PALETTE[idx]
}

// Collision handling: if two users hash to the same color, provide a salt
// (e.g., sessionId or index) to shift them to the next palette slot.
