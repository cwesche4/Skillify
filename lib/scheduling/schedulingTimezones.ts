export type SchedulingTimezoneOption = {
  value: string
  label: string
  shortLabel: string
  searchTerms: string[]
}

const timezoneOptions: SchedulingTimezoneOption[] = [
  {
    value: 'America/New_York',
    label: 'Eastern Time - New York',
    shortLabel: 'New York',
    searchTerms: ['eastern', 'est', 'edt', 'nyc', 'new york', 'us east'],
  },
  {
    value: 'America/Chicago',
    label: 'Central Time - Chicago',
    shortLabel: 'Chicago',
    searchTerms: ['central', 'cst', 'cdt', 'chicago', 'us central'],
  },
  {
    value: 'America/Denver',
    label: 'Mountain Time - Denver',
    shortLabel: 'Denver',
    searchTerms: ['mountain', 'mst', 'mdt', 'denver', 'us mountain'],
  },
  {
    value: 'America/Los_Angeles',
    label: 'Pacific Time - Los Angeles',
    shortLabel: 'Los Angeles',
    searchTerms: ['pacific', 'pst', 'pdt', 'los angeles', 'la', 'us west'],
  },
  {
    value: 'America/Phoenix',
    label: 'Arizona Time - Phoenix',
    shortLabel: 'Phoenix',
    searchTerms: ['arizona', 'phoenix', 'mst'],
  },
  {
    value: 'America/Anchorage',
    label: 'Alaska Time - Anchorage',
    shortLabel: 'Anchorage',
    searchTerms: ['alaska', 'anchorage', 'akst', 'akdt'],
  },
  {
    value: 'Pacific/Honolulu',
    label: 'Hawaii Time - Honolulu',
    shortLabel: 'Honolulu',
    searchTerms: ['hawaii', 'honolulu', 'hst'],
  },
  {
    value: 'America/Toronto',
    label: 'Eastern Time - Toronto',
    shortLabel: 'Toronto',
    searchTerms: ['canada eastern', 'toronto', 'ontario'],
  },
  {
    value: 'America/Vancouver',
    label: 'Pacific Time - Vancouver',
    shortLabel: 'Vancouver',
    searchTerms: ['canada pacific', 'vancouver', 'british columbia'],
  },
  {
    value: 'Europe/London',
    label: 'United Kingdom - London',
    shortLabel: 'London',
    searchTerms: ['uk', 'britain', 'gmt', 'bst', 'london'],
  },
  {
    value: 'Europe/Paris',
    label: 'Central Europe - Paris',
    shortLabel: 'Paris',
    searchTerms: ['central europe', 'cet', 'cest', 'paris'],
  },
  {
    value: 'Europe/Berlin',
    label: 'Central Europe - Berlin',
    shortLabel: 'Berlin',
    searchTerms: ['central europe', 'cet', 'cest', 'berlin'],
  },
  {
    value: 'Asia/Tokyo',
    label: 'Japan Time - Tokyo',
    shortLabel: 'Tokyo',
    searchTerms: ['japan', 'jst', 'tokyo'],
  },
  {
    value: 'Asia/Singapore',
    label: 'Singapore Time - Singapore',
    shortLabel: 'Singapore',
    searchTerms: ['sgt', 'singapore'],
  },
  {
    value: 'Australia/Sydney',
    label: 'Australian Eastern Time - Sydney',
    shortLabel: 'Sydney',
    searchTerms: ['australia', 'aedt', 'aest', 'sydney'],
  },
  {
    value: 'UTC',
    label: 'Coordinated Universal Time',
    shortLabel: 'UTC',
    searchTerms: ['utc', 'gmt', 'zulu'],
  },
]

const timezoneByValue = new Map(
  timezoneOptions.map((option) => [option.value, option]),
)

function browserSupportsTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function getSchedulingTimezoneOptions() {
  return timezoneOptions.filter((option) =>
    browserSupportsTimezone(option.value),
  )
}

export function isSupportedSchedulingTimezone(
  value: string | null | undefined,
) {
  if (!value?.trim()) return false
  const trimmed = value.trim()
  return timezoneByValue.has(trimmed) && browserSupportsTimezone(trimmed)
}

export function normalizeSchedulingTimezone({
  timezone,
  workspaceTimezone,
  fallbackTimezone,
}: {
  timezone?: string | null
  workspaceTimezone?: string | null
  fallbackTimezone?: string | null
}) {
  const candidates = [
    timezone,
    workspaceTimezone,
    fallbackTimezone,
    'America/New_York',
    'UTC',
  ]
  return (
    candidates
      .find((candidate) => isSupportedSchedulingTimezone(candidate))
      ?.trim() ?? 'UTC'
  )
}

export function getSchedulingTimezoneOption(value: string) {
  return (
    timezoneByValue.get(value) ?? {
      value,
      label: value,
      shortLabel: value,
      searchTerms: [value],
    }
  )
}

export function filterSchedulingTimezoneOptions(query: string) {
  const needle = query.trim().toLowerCase()
  const options = getSchedulingTimezoneOptions()
  if (!needle) return options
  return options.filter((option) =>
    [option.value, option.label, option.shortLabel, ...option.searchTerms]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  )
}
