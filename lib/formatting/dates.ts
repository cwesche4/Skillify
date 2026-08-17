function parseWorkspaceDate(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value

  // Treat legacy date-only preview values as local dates, not UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getLocalTimestamp(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(offsetMinutes)
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0')
  const offsetRemainder = String(absoluteOffset % 60).padStart(2, '0')
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainder}`
}

export function formatDate(date: Date | string) {
  return formatWorkspaceDate(date)
}

export function formatWorkspaceDate(
  value: Date | string | null | undefined,
  fallback = '-',
) {
  const date = parseWorkspaceDate(value)
  if (!date) return fallback

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function formatWorkspaceCompactDate(
  value: Date | string | null | undefined,
  fallback = '-',
) {
  const date = parseWorkspaceDate(value)
  if (!date) return fallback

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date)
}

export function formatWorkspaceDateTime(
  value: Date | string | null | undefined,
  fallback = '-',
) {
  const date = parseWorkspaceDate(value)
  if (!date) return fallback

  const today = startOfLocalDay(new Date())
  const target = startOfLocalDay(date)
  const dayDelta = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  if (dayDelta === 0) return `Today • ${time}`
  if (dayDelta === -1) return `Yesterday • ${time}`

  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)} • ${time}`
}

export function toLocalDateInputValue(value: Date | string | null | undefined) {
  const date = parseWorkspaceDate(value)
  if (!date) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
