import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import type {
  SchedulingEvent,
  TeamAvailabilityRecord,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'
import type { WorkspaceBusinessModel } from '@/lib/prisma/enums'

const SETTINGS_VERSION = 1

export const schedulingSettingsChangedEvent =
  'skillify.previewSchedulingSettingsChanged'
export const schedulingEventsChangedEvent =
  'skillify.previewSchedulingEventsChanged'
export const schedulingAvailabilityChangedEvent =
  'skillify.previewSchedulingAvailabilityChanged'

export function getSchedulingSettingsStorageKey(workspaceId: string) {
  return `skillify-preview-scheduling-settings:${workspaceId}`
}

export function getSchedulingEventsStorageKey(workspaceId: string) {
  return `skillify-preview-scheduling-events:${workspaceId}`
}

export function getSchedulingAvailabilityStorageKey(workspaceId: string) {
  return `skillify-preview-scheduling-availability:${workspaceId}`
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function readPreviewSchedulingSettings({
  workspaceId,
  businessModel,
  workspaceTimezone,
}: {
  workspaceId: string
  businessModel: WorkspaceBusinessModel | string
  workspaceTimezone?: string | null
}) {
  const storage = getStorage()
  if (!storage) {
    return normalizeSchedulingSettings({ businessModel, workspaceTimezone })
  }

  try {
    const raw = storage.getItem(getSchedulingSettingsStorageKey(workspaceId))
    if (!raw) {
      return normalizeSchedulingSettings({ businessModel, workspaceTimezone })
    }
    const parsed = JSON.parse(raw) as {
      version?: number
      workspaceId?: string
      settings?: Partial<WorkspaceSchedulingSettings>
    }
    return normalizeSchedulingSettings({
      businessModel,
      settings: parsed.settings,
      workspaceTimezone,
    })
  } catch {
    return normalizeSchedulingSettings({ businessModel, workspaceTimezone })
  }
}

export function savePreviewSchedulingSettings({
  workspaceId,
  businessModel,
  settings,
  workspaceTimezone,
}: {
  workspaceId: string
  businessModel: WorkspaceBusinessModel | string
  settings: WorkspaceSchedulingSettings
  workspaceTimezone?: string | null
}) {
  const normalized = normalizeSchedulingSettings({
    businessModel,
    settings,
    workspaceTimezone,
  })
  const storage = getStorage()
  if (storage) {
    storage.setItem(
      getSchedulingSettingsStorageKey(workspaceId),
      JSON.stringify({
        version: SETTINGS_VERSION,
        workspaceId,
        settings: normalized,
      }),
    )
    window.dispatchEvent(
      new CustomEvent(schedulingSettingsChangedEvent, {
        detail: { workspaceId, settings: normalized },
      }),
    )
  }
  return normalized
}

export function getPreviewSchedulingEvents(
  workspaceId: string,
): SchedulingEvent[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(getSchedulingEventsStorageKey(workspaceId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as {
      workspaceId?: string
      records?: SchedulingEvent[]
    }
    return Array.isArray(parsed.records)
      ? parsed.records.filter((record) => record.workspaceId === workspaceId)
      : []
  } catch {
    return []
  }
}

export function savePreviewSchedulingEvents({
  workspaceId,
  events,
}: {
  workspaceId: string
  events: SchedulingEvent[]
}) {
  const storage = getStorage()
  if (!storage) return events
  storage.setItem(
    getSchedulingEventsStorageKey(workspaceId),
    JSON.stringify({
      version: 1,
      workspaceId,
      records: events,
    }),
  )
  window.dispatchEvent(
    new CustomEvent(schedulingEventsChangedEvent, {
      detail: { workspaceId, events },
    }),
  )
  return events
}

function nowIso() {
  return new Date().toISOString()
}

export function createPreviewSchedulingEvent({
  workspaceId,
  event,
}: {
  workspaceId: string
  event: Omit<SchedulingEvent, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>
}) {
  const events = getPreviewSchedulingEvents(workspaceId)
  const now = nowIso()
  const created: SchedulingEvent = {
    ...event,
    id: `sched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    createdAt: now,
    updatedAt: now,
  }
  savePreviewSchedulingEvents({ workspaceId, events: [...events, created] })
  return created
}

export function updatePreviewSchedulingEvent({
  workspaceId,
  eventId,
  changes,
}: {
  workspaceId: string
  eventId: string
  changes: Partial<Omit<SchedulingEvent, 'id' | 'workspaceId' | 'createdAt'>>
}) {
  const events = getPreviewSchedulingEvents(workspaceId)
  const existing = events.find((event) => event.id === eventId)
  if (!existing) return null
  const updated: SchedulingEvent = {
    ...existing,
    ...changes,
    id: existing.id,
    workspaceId,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  }
  savePreviewSchedulingEvents({
    workspaceId,
    events: events.map((event) => (event.id === eventId ? updated : event)),
  })
  return updated
}

export function deletePreviewSchedulingEvent({
  workspaceId,
  eventId,
}: {
  workspaceId: string
  eventId: string
}) {
  const events = getPreviewSchedulingEvents(workspaceId)
  const next = events.filter((event) => event.id !== eventId)
  savePreviewSchedulingEvents({ workspaceId, events: next })
  return next.length !== events.length
}

export function getPreviewTeamAvailabilityRecords(
  workspaceId: string,
): TeamAvailabilityRecord[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(
      getSchedulingAvailabilityStorageKey(workspaceId),
    )
    if (!raw) return []
    const parsed = JSON.parse(raw) as {
      workspaceId?: string
      records?: TeamAvailabilityRecord[]
    }
    if (!Array.isArray(parsed.records)) return []
    const records = parsed.records
      .filter((record) => record.workspaceId === workspaceId)
      .map(normalizePreviewAvailabilityRecord)
    const changed = JSON.stringify(records) !== JSON.stringify(parsed.records)
    if (changed) {
      storage.setItem(
        getSchedulingAvailabilityStorageKey(workspaceId),
        JSON.stringify({
          version: 1,
          workspaceId,
          records,
        }),
      )
    }
    return records
  } catch {
    return []
  }
}

function normalizePreviewAvailabilityRecord(
  record: TeamAvailabilityRecord,
): TeamAvailabilityRecord {
  if (record.kind !== 'blockedTime') return record
  return {
    id: record.id.replace('-blocked-', '-time-off-'),
    workspaceId: record.workspaceId,
    kind: 'timeOff',
    memberId: record.memberId,
    memberName: record.memberName,
    category: 'unavailable',
    title: record.title,
    reason: record.title,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    allDay: false,
    timezone: 'America/New_York',
    createdByUserId: 'owner',
    createdAt: record.startsAt,
    updatedAt: record.endsAt,
  }
}

export function savePreviewTeamAvailabilityRecords({
  workspaceId,
  records,
}: {
  workspaceId: string
  records: TeamAvailabilityRecord[]
}) {
  const storage = getStorage()
  if (storage) {
    storage.setItem(
      getSchedulingAvailabilityStorageKey(workspaceId),
      JSON.stringify({
        version: 1,
        workspaceId,
        records,
      }),
    )
    window.dispatchEvent(
      new CustomEvent(schedulingAvailabilityChangedEvent, {
        detail: { workspaceId, records },
      }),
    )
  }
  return records
}

export function createPreviewTimeOffRecord({
  workspaceId,
  record,
}: {
  workspaceId: string
  record: Omit<
    Extract<TeamAvailabilityRecord, { kind: 'timeOff' }>,
    'id' | 'workspaceId'
  >
}) {
  const records = getPreviewTeamAvailabilityRecords(workspaceId)
  const created: Extract<TeamAvailabilityRecord, { kind: 'timeOff' }> = {
    ...record,
    id: `time_off_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
  }
  savePreviewTeamAvailabilityRecords({
    workspaceId,
    records: [...records, created],
  })
  return created
}

export function createPreviewTeamAvailabilityRecord({
  workspaceId,
  record,
}: {
  workspaceId: string
  record: Omit<TeamAvailabilityRecord, 'id' | 'workspaceId'>
}) {
  const records = getPreviewTeamAvailabilityRecords(workspaceId)
  const created = {
    ...record,
    id: `availability_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
  } as TeamAvailabilityRecord
  savePreviewTeamAvailabilityRecords({
    workspaceId,
    records: [...records, created],
  })
  return created
}

export function updatePreviewTeamAvailabilityRecord({
  workspaceId,
  recordId,
  changes,
}: {
  workspaceId: string
  recordId: string
  changes: Partial<TeamAvailabilityRecord>
}) {
  const records = getPreviewTeamAvailabilityRecords(workspaceId)
  const existing = records.find((record) => record.id === recordId)
  if (!existing) return null
  const updated = {
    ...existing,
    ...changes,
    id: existing.id,
    workspaceId,
  } as TeamAvailabilityRecord
  savePreviewTeamAvailabilityRecords({
    workspaceId,
    records: records.map((record) =>
      record.id === recordId ? updated : record,
    ),
  })
  return updated
}

export function deletePreviewTeamAvailabilityRecord({
  workspaceId,
  recordId,
}: {
  workspaceId: string
  recordId: string
}) {
  const records = getPreviewTeamAvailabilityRecords(workspaceId)
  const next = records.filter((record) => record.id !== recordId)
  savePreviewTeamAvailabilityRecords({ workspaceId, records: next })
  return next.length !== records.length
}
