export const DELAY_UNITS = ['seconds', 'minutes', 'hours', 'days'] as const

export type DelayUnit = (typeof DELAY_UNITS)[number]

const UNIT_ALIASES: Record<string, DelayUnit> = {
  second: 'seconds',
  seconds: 'seconds',
  sec: 'seconds',
  secs: 'seconds',
  s: 'seconds',
  minute: 'minutes',
  minutes: 'minutes',
  min: 'minutes',
  mins: 'minutes',
  m: 'minutes',
  hour: 'hours',
  hours: 'hours',
  hr: 'hours',
  hrs: 'hours',
  h: 'hours',
  day: 'days',
  days: 'days',
  d: 'days',
}

export function normalizeDelayUnit(value: unknown): DelayUnit | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!normalized) return null
  return UNIT_ALIASES[normalized] ?? null
}

export function formatDelayUnit(value: unknown, duration?: unknown) {
  const unit = normalizeDelayUnit(value) ?? 'minutes'
  const amount = Number(duration)
  const singular = Number.isFinite(amount) && amount === 1
  const label = singular ? unit.replace(/s$/, '') : unit
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDelaySummary({
  duration,
  unit,
}: {
  duration: unknown
  unit: unknown
}) {
  const amount = Number(duration)
  const displayAmount = Number.isFinite(amount) && amount > 0 ? amount : 30
  return `Wait ${displayAmount} ${formatDelayUnit(unit, displayAmount)}`
}

export function isDelayUnit(value: unknown): value is DelayUnit {
  return normalizeDelayUnit(value) === value
}
