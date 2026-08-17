import { createHash } from 'crypto'

import type { CalendarEventMapping } from '@prisma/client'

import type { ProviderEventPayload } from '@/lib/scheduling/providers/types'
import type { SchedulingEvent } from '@/lib/scheduling/types'

export type GoogleDuplicateConfidence = 'none' | 'low' | 'medium' | 'high'

export type GoogleDuplicateCandidate = {
  skillifyEventId: string
  providerEventId: string
  score: number
  confidence: GoogleDuplicateConfidence
  reasons: string[]
}

export type GoogleImportPreview = {
  existingSkillifyEvents: number
  existingGoogleEvents: number
  duplicates: GoogleDuplicateCandidate[]
  eventsToImport: ProviderEventPayload[]
  eventsToExport: SchedulingEvent[]
  eventsSkipped: Array<{
    providerEventId?: string
    skillifyEventId?: string
    reason: string
  }>
  conflicts: GoogleDuplicateCandidate[]
}

export type GoogleConflictFieldComparison = {
  field: string
  skillifyValue: unknown
  providerValue: unknown
  changedInSkillify: boolean
  changedInProvider: boolean
  mergeable: boolean
}

export type GoogleConflictMergePlan = {
  mergeable: boolean
  requiresUserChoice: string[]
  mergedFields: Record<string, unknown>
  comparisons: GoogleConflictFieldComparison[]
}

export type GoogleMappingIntegrityFinding = {
  severity: 'info' | 'warning' | 'error'
  code: string
  message: string
  repairable: boolean
  mappingId?: string
  providerEventId?: string
  schedulingEventId?: string | null
  metadata?: Record<string, unknown>
}

export type GoogleWebhookDeliveryDecision =
  | {
      action: 'process'
      reason: 'newDelivery'
    }
  | {
      action: 'ignore'
      reason:
        | 'duplicateDelivery'
        | 'staleDelivery'
        | 'expiredChannel'
        | 'resourceMismatch'
        | 'unknownChannel'
    }

const comparableFields = [
  'title',
  'startsAt',
  'endsAt',
  'timezone',
  'location',
  'description',
  'recurrence',
] as const

function normalizeComparableText(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeComparableText(value)
  return normalized || null
}

function asTime(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function recurrenceFingerprint(value: unknown) {
  if (!value) return null
  if (Array.isArray(value)) return value.join('|')
  return JSON.stringify(value)
}

function providerComparable(providerEvent: ProviderEventPayload) {
  return {
    title: normalizeComparableText(providerEvent.title),
    startsAt: asTime(providerEvent.startsAtUtc),
    endsAt: asTime(providerEvent.endsAtUtc),
    timezone: normalizeComparableText(providerEvent.timezone),
    location: normalizeOptionalText(providerEvent.location),
    description: normalizeOptionalText(providerEvent.description),
    recurrence: recurrenceFingerprint(providerEvent.recurrence),
    providerEventId: providerEvent.id,
  }
}

function skillifyComparable(event: SchedulingEvent) {
  return {
    title: normalizeComparableText(event.title),
    startsAt: asTime(event.startsAt),
    endsAt: asTime(event.endsAt),
    timezone: normalizeComparableText(event.timezone),
    location: normalizeOptionalText(
      event.locationLabel ??
        event.locationAddress ??
        event.meetingUrl ??
        event.location,
    ),
    description: normalizeOptionalText(event.description),
    recurrence: recurrenceFingerprint(event.recurrenceRule),
    skillifyEventId: event.id,
  }
}

function confidenceFromScore(score: number): GoogleDuplicateConfidence {
  if (score >= 85) return 'high'
  if (score >= 65) return 'medium'
  if (score >= 40) return 'low'
  return 'none'
}

export function scoreGoogleDuplicateCandidate({
  providerEvent,
  skillifyEvent,
  mappedProviderEventIds = new Set<string>(),
}: {
  providerEvent: ProviderEventPayload
  skillifyEvent: SchedulingEvent
  mappedProviderEventIds?: Set<string>
}): GoogleDuplicateCandidate {
  const provider = providerComparable(providerEvent)
  const skillify = skillifyComparable(skillifyEvent)
  const reasons: string[] = []
  let score = 0

  if (
    provider.providerEventId &&
    mappedProviderEventIds.has(provider.providerEventId)
  ) {
    score += 100
    reasons.push('Provider event is already mapped.')
  }
  if (provider.title && provider.title === skillify.title) {
    score += 20
    reasons.push('Title matches.')
  }
  if (provider.startsAt !== null && provider.startsAt === skillify.startsAt) {
    score += 25
    reasons.push('Start time matches.')
  }
  if (provider.endsAt !== null && provider.endsAt === skillify.endsAt) {
    score += 20
    reasons.push('End time matches.')
  }
  if (provider.timezone && provider.timezone === skillify.timezone) {
    score += 10
    reasons.push('Timezone matches.')
  }
  if (provider.location && provider.location === skillify.location) {
    score += 10
    reasons.push('Location matches.')
  }
  if (provider.description && provider.description === skillify.description) {
    score += 5
    reasons.push('Description matches.')
  }
  if (provider.recurrence && provider.recurrence === skillify.recurrence) {
    score += 10
    reasons.push('Recurrence matches.')
  }

  const boundedScore = Math.min(score, 100)
  return {
    skillifyEventId: skillifyEvent.id,
    providerEventId: providerEvent.id ?? '',
    score: boundedScore,
    confidence: confidenceFromScore(boundedScore),
    reasons,
  }
}

export function createGoogleImportPreview({
  skillifyEvents,
  googleEvents,
  mappings = [],
}: {
  skillifyEvents: SchedulingEvent[]
  googleEvents: ProviderEventPayload[]
  mappings?: Array<
    Pick<CalendarEventMapping, 'providerEventId' | 'schedulingEventId'>
  >
}): GoogleImportPreview {
  const mappedProviderEventIds = new Set(
    mappings.map((mapping) => mapping.providerEventId).filter(Boolean),
  )
  const mappedSkillifyEventIds = new Set(
    mappings.flatMap((mapping) =>
      mapping.schedulingEventId ? [mapping.schedulingEventId] : [],
    ),
  )

  const duplicates = googleEvents.flatMap((providerEvent) => {
    const best = skillifyEvents
      .map((skillifyEvent) =>
        scoreGoogleDuplicateCandidate({
          providerEvent,
          skillifyEvent,
          mappedProviderEventIds,
        }),
      )
      .sort((a, b) => b.score - a.score)[0]
    return best && best.confidence !== 'none' ? [best] : []
  })
  const duplicateProviderIds = new Set(
    duplicates
      .filter((candidate) => candidate.confidence === 'high')
      .map((candidate) => candidate.providerEventId),
  )

  return {
    existingSkillifyEvents: skillifyEvents.length,
    existingGoogleEvents: googleEvents.length,
    duplicates,
    eventsToImport: googleEvents.filter(
      (event) =>
        event.id &&
        !mappedProviderEventIds.has(event.id) &&
        !duplicateProviderIds.has(event.id),
    ),
    eventsToExport: skillifyEvents.filter(
      (event) => !mappedSkillifyEventIds.has(event.id),
    ),
    eventsSkipped: googleEvents
      .filter((event) => !event.id)
      .map((event) => ({
        providerEventId: event.id,
        reason: `Google event "${event.title}" is missing a stable provider ID.`,
      })),
    conflicts: duplicates.filter(
      (candidate) => candidate.confidence === 'medium',
    ),
  }
}

export function computeGoogleSyncHash(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(value ?? null))
    .digest('hex')
}

export function shouldIgnoreGoogleProviderLoop({
  mapping,
  providerEvent,
}: {
  mapping?: Pick<
    CalendarEventMapping,
    'lastSyncOrigin' | 'originOperation' | 'providerEtag' | 'syncHash'
  > | null
  providerEvent: ProviderEventPayload
}) {
  if (!mapping || mapping.lastSyncOrigin !== 'skillify') return false
  if (
    mapping.providerEtag &&
    providerEvent.providerEtag === mapping.providerEtag
  ) {
    return true
  }
  const providerHash = computeGoogleSyncHash({
    title: providerEvent.title,
    startsAtUtc: providerEvent.startsAtUtc,
    endsAtUtc: providerEvent.endsAtUtc,
    timezone: providerEvent.timezone,
    location: providerEvent.location,
    description: providerEvent.description,
    recurrence: providerEvent.recurrence,
  })
  return Boolean(mapping.syncHash && mapping.syncHash === providerHash)
}

function snapshotValue(
  snapshot: Record<string, unknown> | null,
  field: string,
) {
  if (!snapshot) return undefined
  return snapshot[field]
}

export function buildGoogleConflictMergePlan({
  skillifyCurrent,
  providerCurrent,
  skillifyBaseline,
  providerBaseline,
}: {
  skillifyCurrent: Record<string, unknown>
  providerCurrent: Record<string, unknown>
  skillifyBaseline?: Record<string, unknown> | null
  providerBaseline?: Record<string, unknown> | null
}): GoogleConflictMergePlan {
  const comparisons = comparableFields.map((field) => {
    const skillifyValue = snapshotValue(skillifyCurrent, field)
    const providerValue = snapshotValue(providerCurrent, field)
    const changedInSkillify =
      JSON.stringify(skillifyValue) !==
      JSON.stringify(snapshotValue(skillifyBaseline ?? null, field))
    const changedInProvider =
      JSON.stringify(providerValue) !==
      JSON.stringify(snapshotValue(providerBaseline ?? null, field))
    return {
      field,
      skillifyValue,
      providerValue,
      changedInSkillify,
      changedInProvider,
      mergeable:
        !(changedInSkillify && changedInProvider) ||
        JSON.stringify(skillifyValue) === JSON.stringify(providerValue),
    }
  })
  const requiresUserChoice = comparisons
    .filter((comparison) => !comparison.mergeable)
    .map((comparison) => comparison.field)
  const mergedFields = Object.fromEntries(
    comparisons
      .filter((comparison) => comparison.mergeable)
      .map((comparison) => [
        comparison.field,
        comparison.changedInProvider
          ? comparison.providerValue
          : comparison.skillifyValue,
      ]),
  )
  return {
    mergeable: requiresUserChoice.length === 0,
    requiresUserChoice,
    mergedFields,
    comparisons,
  }
}

export function inspectGoogleMappingIntegrity({
  mappings,
  knownSkillifyEventIds = new Set<string>(),
}: {
  mappings: Array<
    Pick<
      CalendarEventMapping,
      | 'id'
      | 'providerEventId'
      | 'schedulingEventId'
      | 'connectedCalendarId'
      | 'recurrenceSeriesId'
      | 'occurrenceId'
    >
  >
  knownSkillifyEventIds?: Set<string>
}): GoogleMappingIntegrityFinding[] {
  const findings: GoogleMappingIntegrityFinding[] = []
  const providerKeyCounts = new Map<string, number>()
  const skillifyKeyCounts = new Map<string, number>()
  for (const mapping of mappings) {
    const providerKey = `${mapping.connectedCalendarId}:${mapping.providerEventId}`
    providerKeyCounts.set(
      providerKey,
      (providerKeyCounts.get(providerKey) ?? 0) + 1,
    )
    if (mapping.schedulingEventId) {
      skillifyKeyCounts.set(
        mapping.schedulingEventId,
        (skillifyKeyCounts.get(mapping.schedulingEventId) ?? 0) + 1,
      )
      if (
        knownSkillifyEventIds.size > 0 &&
        !knownSkillifyEventIds.has(mapping.schedulingEventId)
      ) {
        findings.push({
          severity: 'warning',
          code: 'missingSkillifyEvent',
          message: 'A Google mapping points at a missing Skillify event.',
          repairable: true,
          mappingId: mapping.id,
          providerEventId: mapping.providerEventId,
          schedulingEventId: mapping.schedulingEventId,
        })
      }
    }
    if (!mapping.providerEventId) {
      findings.push({
        severity: 'error',
        code: 'missingProviderEventId',
        message: 'A Google mapping is missing its provider event ID.',
        repairable: true,
        mappingId: mapping.id,
        schedulingEventId: mapping.schedulingEventId,
      })
    }
    if (mapping.occurrenceId && !mapping.recurrenceSeriesId) {
      findings.push({
        severity: 'warning',
        code: 'occurrenceSeriesMismatch',
        message: 'A Google occurrence mapping is missing a recurrence series.',
        repairable: false,
        mappingId: mapping.id,
        providerEventId: mapping.providerEventId,
        schedulingEventId: mapping.schedulingEventId,
      })
    }
  }
  for (const [providerKey, count] of providerKeyCounts) {
    if (count > 1) {
      findings.push({
        severity: 'error',
        code: 'duplicateProviderMapping',
        message: 'Multiple mappings point at the same Google event.',
        repairable: true,
        providerEventId: providerKey.split(':').slice(1).join(':'),
        metadata: { count },
      })
    }
  }
  for (const [schedulingEventId, count] of skillifyKeyCounts) {
    if (count > 1) {
      findings.push({
        severity: 'warning',
        code: 'multipleProviderEvents',
        message: 'One Skillify event is mapped to multiple Google events.',
        repairable: true,
        schedulingEventId,
        metadata: { count },
      })
    }
  }
  return findings
}

export function classifyGoogleWebhookDelivery({
  channelResourceId,
  receivedResourceId,
  lastMessageNumber,
  messageNumber,
  expiresAt,
  now = new Date(),
}: {
  channelResourceId?: string | null
  receivedResourceId?: string | null
  lastMessageNumber?: string | null
  messageNumber?: string | null
  expiresAt?: Date | null
  now?: Date
}): GoogleWebhookDeliveryDecision {
  if (expiresAt && expiresAt < now) {
    return { action: 'ignore', reason: 'expiredChannel' }
  }
  if (
    channelResourceId &&
    receivedResourceId &&
    channelResourceId !== receivedResourceId
  ) {
    return { action: 'ignore', reason: 'resourceMismatch' }
  }
  const previous = Number(lastMessageNumber)
  const current = Number(messageNumber)
  if (
    Number.isFinite(previous) &&
    Number.isFinite(current) &&
    current <= previous
  ) {
    return {
      action: 'ignore',
      reason: current === previous ? 'duplicateDelivery' : 'staleDelivery',
    }
  }
  return { action: 'process', reason: 'newDelivery' }
}
