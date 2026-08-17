import type { SchedulingProviderKey } from '@/lib/scheduling/providers/config'
import type { SchedulingEvent } from '@/lib/scheduling/types'

export type CalendarProviderCapability =
  | 'oauth'
  | 'basicAuth'
  | 'calendarDiscovery'
  | 'incrementalSync'
  | 'pollingSync'
  | 'etagSync'
  | 'ctagSync'
  | 'pushSync'
  | 'watchChannels'
  | 'recurrence'
  | 'webhooks'

export type ProviderConnectionHealth =
  | 'connected'
  | 'syncing'
  | 'warning'
  | 'error'
  | 'expired'
  | 'disconnected'

export type ProviderCalendar = {
  id: string
  name: string
  timezone?: string
  isPrimary?: boolean
  accessRole?: string
  ownerEmail?: string
  description?: string
  color?: string
  visibility?: string
  isWritable?: boolean
  raw?: unknown
}

export type ProviderEventAttendee = {
  email: string
  name?: string
  responseStatus?: 'needsAction' | 'accepted' | 'tentative' | 'declined'
}

export type ProviderEventPayload = {
  id?: string
  calendarId: string
  title: string
  description?: string
  startsAtUtc: string
  endsAtUtc: string
  timezone: string
  allDay?: boolean
  location?: string
  attendees?: ProviderEventAttendee[]
  recurrenceRule?: string
  recurrence?: string[]
  visibility?: 'default' | 'public' | 'private' | 'busyOnly'
  providerEtag?: string
  providerUpdatedAt?: string
  recurringEventId?: string
  originalStartTime?: string
  status?: string
  raw?: unknown
}

export type ProviderTokenSet = {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
  scopes?: string[]
  providerAccountId?: string
  accountEmail?: string
  displayName?: string
}

export type ProviderWatchChannel = {
  id: string
  resourceId?: string
  resourceUri?: string
  token?: string
  expiresAt?: Date | null
}

export type ProviderPullChangesResult = {
  events: ProviderEventPayload[]
  nextSyncToken?: string | null
  nextPageToken?: string | null
  fullSyncRequired?: boolean
}

export type ProviderSyncResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      code: string
      safeMessage: string
      retryable: boolean
    }

export type CalendarProviderContext = {
  workspaceId: string
  connectionId?: string
  accessToken?: string
  refreshToken?: string | null
  username?: string | null
  metadata?: Record<string, unknown> | null
}

export type CalendarProvider = {
  key: SchedulingProviderKey
  label: string
  enabled: boolean
  capabilities: CalendarProviderCapability[]
  connect(args: {
    workspaceId: string
    workspaceMemberId?: string
    state: string
    redirectUri?: string
    returnToSetup?: boolean
    setupStep?: string
  }): ProviderSyncResult<{ authorizationUrl: string }>
  disconnect(
    ctx: CalendarProviderContext,
  ): Promise<ProviderSyncResult<{ disconnected: true }>>
  refreshToken(
    ctx: CalendarProviderContext,
  ): Promise<ProviderSyncResult<ProviderTokenSet>>
  exchangeCode(args: {
    code: string
    redirectUri?: string
  }): Promise<ProviderSyncResult<ProviderTokenSet>>
  listCalendars(
    ctx: CalendarProviderContext,
  ): Promise<ProviderSyncResult<ProviderCalendar[]>>
  watchCalendar(
    ctx: CalendarProviderContext & {
      calendarId: string
      channelId: string
      webhookUrl: string
      token?: string
    },
  ): Promise<ProviderSyncResult<ProviderWatchChannel>>
  stopWatching(
    ctx: CalendarProviderContext & {
      channelId: string
      resourceId: string
    },
  ): Promise<ProviderSyncResult<{ stopped: true }>>
  pullChanges(
    ctx: CalendarProviderContext & {
      calendarId: string
      syncToken?: string | null
      pageToken?: string | null
    },
  ): Promise<ProviderSyncResult<ProviderPullChangesResult>>
  pushChanges(
    ctx: CalendarProviderContext & {
      calendarId: string
      events: SchedulingEvent[]
    },
  ): Promise<ProviderSyncResult<{ pushed: number }>>
  createEvent(
    ctx: CalendarProviderContext,
    payload: ProviderEventPayload,
  ): Promise<ProviderSyncResult<ProviderEventPayload>>
  updateEvent(
    ctx: CalendarProviderContext,
    payload: ProviderEventPayload & { id: string },
  ): Promise<ProviderSyncResult<ProviderEventPayload>>
  deleteEvent(
    ctx: CalendarProviderContext & {
      calendarId: string
      providerEventId: string
    },
  ): Promise<ProviderSyncResult<{ deleted: true }>>
  getEvent(
    ctx: CalendarProviderContext & {
      calendarId: string
      providerEventId: string
    },
  ): Promise<ProviderSyncResult<ProviderEventPayload | null>>
  sync(
    ctx: CalendarProviderContext,
  ): Promise<ProviderSyncResult<{ processed: number }>>
  health(
    ctx: CalendarProviderContext,
  ): Promise<ProviderSyncResult<{ health: ProviderConnectionHealth }>>
  validateConnection(
    ctx: CalendarProviderContext,
  ): Promise<ProviderSyncResult<{ valid: boolean }>>
}
