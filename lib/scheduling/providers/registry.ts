import {
  getSchedulingProviderConfig,
  type SchedulingProviderKey,
} from '@/lib/scheduling/providers/config'
import { createGoogleCalendarProvider } from '@/lib/scheduling/providers/google'
import { createMicrosoftCalendarProvider } from '@/lib/scheduling/providers/microsoft'
import { createCalDavCalendarProvider } from '@/lib/scheduling/providers/caldav'
import type {
  CalendarProvider,
  CalendarProviderContext,
  ProviderEventPayload,
  ProviderSyncResult,
} from '@/lib/scheduling/providers/types'

const registeredProviderKeys: SchedulingProviderKey[] = [
  'google',
  'microsoft',
  'appleIcloud',
  'caldav',
  'ics',
]

function disabledResult<T>({
  provider,
  operation,
}: {
  provider: SchedulingProviderKey
  operation: string
}): ProviderSyncResult<T> {
  const config = getSchedulingProviderConfig(provider)
  return {
    ok: false,
    code: config.status,
    safeMessage:
      config.status === 'available'
        ? `${config.label} ${operation} is not implemented in this runtime.`
        : `${config.label} ${operation} is unavailable because provider status is ${config.status}.`,
    retryable: config.status === 'available',
  }
}

function createDisabledProvider(key: SchedulingProviderKey): CalendarProvider {
  const config = getSchedulingProviderConfig(key)
  const disabled = <T>(operation: string) =>
    disabledResult<T>({ provider: key, operation })
  return {
    key,
    label: config.label,
    enabled: false,
    capabilities: [],
    connect() {
      return disabled('connect')
    },
    async disconnect(_ctx: CalendarProviderContext) {
      return disabled('disconnect')
    },
    async refreshToken(_ctx: CalendarProviderContext) {
      return disabled('token refresh')
    },
    async exchangeCode() {
      return disabled('OAuth callback')
    },
    async listCalendars() {
      return disabled('calendar listing')
    },
    async watchCalendar() {
      return disabled('watch channel creation')
    },
    async stopWatching() {
      return disabled('watch channel stop')
    },
    async pullChanges() {
      return disabled('incremental sync')
    },
    async pushChanges() {
      return disabled('event push')
    },
    async createEvent(
      _ctx: CalendarProviderContext,
      _payload: ProviderEventPayload,
    ) {
      return disabled('event creation')
    },
    async updateEvent(_ctx, _payload) {
      return disabled('event update')
    },
    async deleteEvent() {
      return disabled('event deletion')
    },
    async getEvent() {
      return disabled('event lookup')
    },
    async sync() {
      return disabled('sync')
    },
    async health() {
      return disabled('health check')
    },
    async validateConnection() {
      return disabled('connection validation')
    },
  }
}

export function getSchedulingProviderAdapter(
  key: SchedulingProviderKey,
): CalendarProvider {
  if (key === 'google') {
    const provider = createGoogleCalendarProvider()
    return provider.enabled ? provider : createDisabledProvider(key)
  }
  if (key === 'microsoft') {
    const provider = createMicrosoftCalendarProvider()
    return provider.enabled ? provider : createDisabledProvider(key)
  }
  if (key === 'caldav') {
    const provider = createCalDavCalendarProvider()
    return provider.enabled ? provider : createDisabledProvider(key)
  }
  return createDisabledProvider(key)
}

export function getSchedulingProviderAdapters(): CalendarProvider[] {
  return registeredProviderKeys.map((key) => getSchedulingProviderAdapter(key))
}

export function getSchedulingProviderRegistry() {
  return registeredProviderKeys.map((key) => {
    const config = getSchedulingProviderConfig(key)
    return {
      key,
      label: config.label,
      enabled:
        (key === 'google' || key === 'microsoft' || key === 'caldav') &&
        config.status === 'available',
      status: config.status,
      syncEnabled: config.syncEnabled,
      missing: config.missing,
      capabilities:
        key === 'google' || key === 'microsoft'
          ? [
              'oauth',
              'calendarDiscovery',
              'incrementalSync',
              'pushSync',
              'watchChannels',
              'recurrence',
              'webhooks',
            ]
          : key === 'caldav'
            ? [
                'basicAuth',
                'calendarDiscovery',
                'incrementalSync',
                'pollingSync',
                'etagSync',
                'ctagSync',
                'pushSync',
                'recurrence',
              ]
            : [],
    }
  })
}
