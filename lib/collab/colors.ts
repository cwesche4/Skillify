'use client'

// Deterministic, accessible palette for presence cursors and labels.
const PALETTE = [
  { base: '#38bdf8', ring: '#0ea5e9', label: 'cyan' },
  { base: '#a78bfa', ring: '#8b5cf6', label: 'violet' },
  { base: '#f472b6', ring: '#ec4899', label: 'pink' },
  { base: '#fb923c', ring: '#f97316', label: 'orange' },
  { base: '#34d399', ring: '#10b981', label: 'emerald' },
  { base: '#facc15', ring: '#eab308', label: 'amber' },
  { base: '#60a5fa', ring: '#3b82f6', label: 'blue' },
  { base: '#f87171', ring: '#ef4444', label: 'red' },
  { base: '#4ade80', ring: '#22c55e', label: 'green' },
  { base: '#c084fc', ring: '#a855f7', label: 'purple' },
  { base: '#fbbf24', ring: '#f59e0b', label: 'gold' },
  { base: '#67e8f9', ring: '#22d3ee', label: 'teal' },
  { base: '#fda4af', ring: '#fb7185', label: 'rose' },
  { base: '#bef264', ring: '#84cc16', label: 'lime' },
]

function hashString(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function getPresenceColor(
  userId: string,
  salt: string | number = 0,
): { base: string; ring: string; label: string } {
  const h = hashString(String(userId)) + hashString(String(salt))
  const idx = h % PALETTE.length
  return PALETTE[idx]
}

export function getCursorColorClassName(
  userId: string,
  salt: string | number = 0,
) {
  const color = getPresenceColor(userId, salt)
  return `ring-[${color.ring}] text-[${color.base}]`
}

// Quick validation helper (non-exported) to ensure palette size > 0.
function __validatePalette() {
  if (!PALETTE.length) throw new Error('Presence palette is empty')
}
__validatePalette()
