import {
  CalendarConnectionApprovalStatus,
  CalendarConnectionOwnershipType,
  CalendarConnectionPurpose,
  CalendarConnectionStatus,
  CalendarConflictPolicy,
  CalendarSyncDirection,
  ExternalCalendarVisibilityMode,
} from '@prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  decryptToken,
  encryptToken,
  isIntegrationEncryptionConfigured,
} from '@/lib/integrations/crypto'
import {
  canTransitionSchedulingEventStatus,
  doesSchedulingStatusConsumeAvailability,
  getSchedulingStatusTransitionEffect,
} from '@/lib/scheduling/events/statusTransitions'
import { createSchedulingEventChangedOutboxEvents } from '@/lib/scheduling/outbox/domainOutbox'
import {
  getSchedulingIntegrationSummary,
  getSchedulingProviderConfig,
} from '@/lib/scheduling/providers/config'
import {
  classifyCalendarConnectionPurpose,
  coerceCalendarSyncDirectionForPolicy,
  resolvePersonalCalendarAccess,
  resolvePersonalCalendarApprovalAuthority,
  resolveCalendarClassificationConfirmation,
  resolveCalendarConnectionSyncEligibility,
  getCalendarClassificationConfirmationStatus,
  sanitizeExternalCalendarEvent,
} from '@/lib/scheduling/providers/calendarGovernance'
import {
  getSchedulingProviderAdapter,
  getSchedulingProviderRegistry,
} from '@/lib/scheduling/providers/registry'
import { mapSkillifyRecurrenceToRRule } from '@/lib/scheduling/providers/recurrenceMapping'
import {
  detectCalendarSyncConflict,
  resolveCalendarConflictByPolicy,
} from '@/lib/scheduling/providers/syncEngine'
import {
  buildGoogleConflictMergePlan,
  classifyGoogleWebhookDelivery,
  computeGoogleSyncHash,
  createGoogleImportPreview,
  inspectGoogleMappingIntegrity,
  scoreGoogleDuplicateCandidate,
  shouldIgnoreGoogleProviderLoop,
} from '@/lib/scheduling/providers/googleSyncHardening'
import {
  doesSchedulingEventConsumeAvailability,
  findSchedulingAvailabilityConflicts,
} from '@/lib/scheduling/sync/conflicts'
import {
  resolveSchedulingLinkedRecordRule,
  validateSchedulingLinkedRecord,
} from '@/lib/scheduling/linkedRecordRules'
import {
  normalizeSchedulingSettings,
  normalizeWorkspaceCalendarConnectionPolicy,
} from '@/lib/scheduling/normalizeSchedulingSettings'
import { getWorkspaceSchedulingCapabilities } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import {
  SchedulingEventTimeValidationError,
  validateSchedulingEventTimestampRange,
} from '@/lib/scheduling/eventTimeValidation'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import type {
  SchedulingEvent,
  SchedulingOccurrence,
} from '@/lib/scheduling/types'

const originalEnv = { ...process.env }

function resetEnv() {
  process.env = { ...originalEnv }
}

afterEach(() => {
  vi.restoreAllMocks()
  resetEnv()
})

function event(overrides: Partial<SchedulingEvent> = {}): SchedulingEvent {
  return {
    id: 'event-1',
    workspaceId: 'workspace-1',
    title: 'Discovery Call',
    type: 'discoveryCall',
    status: 'scheduled',
    startsAt: '2026-07-27T14:00:00.000Z',
    endsAt: '2026-07-27T15:00:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['member-1'],
    createdAt: '2026-07-27T12:00:00.000Z',
    updatedAt: '2026-07-27T12:00:00.000Z',
    ...overrides,
  }
}

describe('production scheduling credential safety', () => {
  it('fails closed instead of storing plaintext provider credentials without an encryption key', () => {
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY

    expect(isIntegrationEncryptionConfigured()).toBe(false)
    expect(() => encryptToken('secret-token')).toThrow(
      /INTEGRATIONS_ENCRYPTION_KEY must be configured/,
    )
    expect(() => decryptToken('secret-token')).toThrow(
      /INTEGRATIONS_ENCRYPTION_KEY must be configured/,
    )
  })

  it('encrypts and decrypts provider credentials when the encryption key is configured', () => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    )

    const encrypted = encryptToken('secret-token')

    expect(encrypted).not.toBe('secret-token')
    expect(decryptToken(encrypted)).toBe('secret-token')
  })
})

describe('calendar provider governance', () => {
  it('normalizes conservative workspace calendar policy defaults', () => {
    const settings = normalizeSchedulingSettings({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      settings: {},
    })

    expect(settings.calendarConnectionPolicy).toMatchObject({
      allowMemberConnections: false,
      allowMultipleAccountsPerMember: true,
      allowWorkspaceConnections: true,
      requireMemberConnectionApproval: true,
      allowMemberTwoWaySync: false,
      allowMemberWriteOnlySync: false,
      allowMemberReadOnlySync: true,
      includeMemberCalendarsInBusy: true,
      defaultMemberVisibilityMode: 'BUSY_ONLY',
      defaultWorkspaceVisibilityMode: 'TITLE_ONLY',
    })
  })

  it('normalizes invalid policy combinations safely', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      allowMemberConnections: false,
      allowMemberTwoWaySync: true,
      allowMemberWriteOnlySync: true,
      allowMemberVisibilityOverride: true,
      defaultMemberVisibilityMode: 'INVALID',
    })

    expect(policy.allowMemberTwoWaySync).toBe(false)
    expect(policy.allowMemberWriteOnlySync).toBe(false)
    expect(policy.allowMemberVisibilityOverride).toBe(false)
    expect(policy.defaultMemberVisibilityMode).toBe('BUSY_ONLY')
  })

  it('normalizes personal calendar policy without allowing Time Off promotion', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      personalCalendarMode: 'SELECTED_ROLES',
      personalCalendarAllowedRoleKeys: ['owner', 'dispatcher', 'ADMIN'],
      personalCalendarDeniedMemberIds: [' member-2 ', 'member-2'],
      personalCalendarAvailabilityBehavior: 'BLOCK_AVAILABILITY',
      personalCalendarBusyDisplayMode: 'EXPANDABLE_EXTERNAL_AVAILABILITY',
      personalCalendarDefaultVisibilityMode: 'FULL_DETAILS',
      treatPersonalEventsAsOfficialTimeOff: true,
      workspaceBusinessDomains: [
        { domain: 'HTTPS://www.Skillify.example/path', status: 'verified' },
        { domain: 'bad value', status: 'verified' },
      ],
    })

    expect(policy.personalCalendarMode).toBe('SELECTED_ROLES')
    expect(policy.personalCalendarAllowedRoleKeys).toEqual(['OWNER', 'ADMIN'])
    expect(policy.personalCalendarDeniedMemberIds).toEqual(['member-2'])
    expect(policy.personalCalendarAvailabilityBehavior).toBe(
      'BLOCK_AVAILABILITY',
    )
    expect(policy.personalCalendarBusyDisplayMode).toBe(
      'EXPANDABLE_EXTERNAL_AVAILABILITY',
    )
    expect(policy.personalCalendarDefaultVisibilityMode).toBe('FULL_DETAILS')
    expect(policy.treatPersonalEventsAsOfficialTimeOff).toBe(false)
    expect(policy.workspaceBusinessDomains).toEqual([
      {
        domain: 'skillify.example',
        status: 'verified',
        primary: false,
      },
    ])
  })

  it('classifies consumer email domains as suggested personal calendars', () => {
    const classification = classifyCalendarConnectionPurpose({
      provider: 'google',
      providerEmail: 'owner@gmail.com',
    })

    expect(classification).toMatchObject({
      purpose: CalendarConnectionPurpose.PERSONAL,
      reasonCode: 'consumerAccountSignal',
      requiresConfirmation: true,
    })
  })

  it('classifies workspace domain matches as suggested individual work calendars', () => {
    const classification = classifyCalendarConnectionPurpose({
      provider: 'microsoft',
      providerEmail: 'jane@smithsplumbing.com',
      workspaceBusinessDomains: [
        {
          domain: 'smithsplumbing.com',
          status: 'adminConfirmed',
        },
      ],
    })

    expect(classification).toMatchObject({
      purpose: CalendarConnectionPurpose.INDIVIDUAL_WORK,
      reasonCode: 'workspaceBusinessDomainMatch',
      requiresConfirmation: true,
    })
  })

  it('classifies workspace owned OAuth and resource calendars separately', () => {
    expect(
      classifyCalendarConnectionPurpose({
        ownershipType: CalendarConnectionOwnershipType.WORKSPACE,
      }).purpose,
    ).toBe(CalendarConnectionPurpose.WORKSPACE_SHARED)
    expect(
      classifyCalendarConnectionPurpose({
        providerCalendarMetadata: { isResource: true },
      }).purpose,
    ).toBe(CalendarConnectionPurpose.RESOURCE)
  })

  it('resolves selected role, explicit allow, and explicit deny personal access', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      allowMemberConnections: true,
      personalCalendarMode: 'SELECTED_ROLES',
      personalCalendarAllowedRoleKeys: ['ADMIN'],
      personalCalendarAllowedMemberIds: ['member-explicit'],
      personalCalendarDeniedMemberIds: ['member-denied'],
    })

    expect(
      resolvePersonalCalendarAccess({
        workspacePolicy: policy,
        workspaceMember: { id: 'member-admin', role: 'ADMIN' },
      }).canRequestConnection,
    ).toBe(true)
    expect(
      resolvePersonalCalendarAccess({
        workspacePolicy: policy,
        workspaceMember: { id: 'member-explicit', role: 'MEMBER' },
      }).canRequestConnection,
    ).toBe(true)
    expect(
      resolvePersonalCalendarAccess({
        workspacePolicy: policy,
        workspaceMember: { id: 'member-denied', role: 'ADMIN' },
      }),
    ).toMatchObject({
      canRequestConnection: false,
      reasonCode: 'memberExplicitlyDenied',
    })
  })

  it('supports owner-only personal access without enabling every admin', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      allowMemberConnections: true,
      personalCalendarMode: 'OWNER_ONLY',
    })

    expect(
      resolvePersonalCalendarAccess({
        workspacePolicy: policy,
        workspaceMember: { id: 'owner', role: 'OWNER' },
      }).canRequestConnection,
    ).toBe(true)
    expect(
      resolvePersonalCalendarAccess({
        workspacePolicy: policy,
        workspaceMember: { id: 'admin', role: 'ADMIN' },
      }).canRequestConnection,
    ).toBe(false)
  })

  it('blocks personal calendar self approval unless explicitly allowed', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      personalCalendarApproverMode: 'OWNERS_AND_ADMINS',
      allowPersonalCalendarSelfApproval: false,
    })

    expect(
      resolvePersonalCalendarApprovalAuthority({
        workspacePolicy: policy,
        workspaceMember: { id: 'admin-1', role: 'ADMIN' },
        targetWorkspaceMemberId: 'admin-1',
      }),
    ).toMatchObject({
      canApprove: false,
      selfApprovalBlocked: true,
    })
    expect(
      resolvePersonalCalendarApprovalAuthority({
        workspacePolicy: {
          ...policy,
          allowPersonalCalendarSelfApproval: true,
        },
        workspaceMember: { id: 'admin-1', role: 'ADMIN' },
        targetWorkspaceMemberId: 'admin-1',
      }).canApprove,
    ).toBe(true)
  })

  it('blocks pending member connections from sync and busy contribution', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      allowMemberConnections: true,
    })
    const eligibility = resolveCalendarConnectionSyncEligibility({
      workspacePolicy: policy,
      ownerMember: { id: 'member-1' },
      connection: {
        ownershipType: CalendarConnectionOwnershipType.MEMBER,
        visibilityMode: ExternalCalendarVisibilityMode.BUSY_ONLY,
        approvalStatus: CalendarConnectionApprovalStatus.PENDING,
        syncStatus: CalendarConnectionStatus.CONNECTED,
        disabledAt: null,
        disabledReason: null,
        ownerInactiveAt: null,
        disconnectedAt: null,
      },
    })

    expect(eligibility).toMatchObject({
      canDiscoverCalendars: false,
      canPull: false,
      canPush: false,
      contributesToBusy: false,
      reasonCode: 'approvalPending',
    })
  })

  it('requires post-OAuth confirmation when member-selected work conflicts with consumer-domain suggestion', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      allowMemberConnections: true,
      personalCalendarMode: 'ALL_MEMBERS',
    })
    const confirmation = resolveCalendarClassificationConfirmation({
      requestedPurpose: CalendarConnectionPurpose.INDIVIDUAL_WORK,
      suggestedPurpose: CalendarConnectionPurpose.PERSONAL,
      classificationConfidence: 0.7,
      suggestedReasonCode: 'consumerAccountSignal',
      workspacePolicy: policy,
      actor: { id: 'member-1', role: 'MEMBER' },
      ownershipType: CalendarConnectionOwnershipType.MEMBER,
    })

    expect(confirmation).toMatchObject({
      required: true,
      status: 'PENDING',
      mismatch: true,
      highConfidenceMismatch: true,
    })
  })

  it('allows admin workspace-owned confirmations to skip member confirmation when suggestion matches', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      allowWorkspaceConnections: true,
    })
    const confirmation = resolveCalendarClassificationConfirmation({
      requestedPurpose: CalendarConnectionPurpose.WORKSPACE_SHARED,
      suggestedPurpose: CalendarConnectionPurpose.WORKSPACE_SHARED,
      classificationConfidence: 0.85,
      suggestedReasonCode: 'workspaceOwnedConnection',
      workspacePolicy: policy,
      actor: { id: 'owner-1', role: 'OWNER' },
      ownershipType: CalendarConnectionOwnershipType.WORKSPACE,
    })

    expect(confirmation).toMatchObject({
      required: false,
      status: 'NOT_REQUIRED',
    })
  })

  it('blocks sync while classification confirmation metadata is pending', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      allowMemberConnections: true,
      personalCalendarMode: 'ALL_MEMBERS',
    })
    const eligibility = resolveCalendarConnectionSyncEligibility({
      workspacePolicy: policy,
      ownerMember: { id: 'member-1', role: 'MEMBER' },
      connection: {
        ownershipType: CalendarConnectionOwnershipType.MEMBER,
        connectionPurpose: CalendarConnectionPurpose.PERSONAL,
        visibilityMode: ExternalCalendarVisibilityMode.BUSY_ONLY,
        availabilityBehavior: 'SUGGEST_CONFLICTS',
        busyDisplayMode: 'HIDDEN',
        approvalStatus: CalendarConnectionApprovalStatus.NEEDS_REVIEW,
        syncStatus: CalendarConnectionStatus.NEEDS_ATTENTION,
        disabledAt: null,
        disabledReason: null,
        ownerInactiveAt: null,
        disconnectedAt: null,
        metadata: {
          classificationConfirmation: {
            status: 'PENDING',
            requestedPurpose: 'INDIVIDUAL_WORK',
            suggestedPurpose: 'PERSONAL',
            suggestedSource: 'DOMAIN_HEURISTIC',
            classificationConfidence: 0.7,
            reasonCode: 'consumerAccountSignal',
          },
        },
      },
    })

    expect(
      getCalendarClassificationConfirmationStatus({
        classificationConfirmation: {
          status: 'PENDING',
          requestedPurpose: 'INDIVIDUAL_WORK',
          suggestedPurpose: 'PERSONAL',
          suggestedSource: 'DOMAIN_HEURISTIC',
          classificationConfidence: 0.7,
          reasonCode: 'consumerAccountSignal',
        },
      }),
    ).toBe('PENDING')
    expect(eligibility).toMatchObject({
      canPull: false,
      canPush: false,
      contributesToBusy: false,
      reasonCode: 'classificationPending',
    })
  })

  it('keeps ignored personal calendars out of busy while allowing approved suggestions to pull', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      allowMemberConnections: true,
      personalCalendarMode: 'ALL_MEMBERS',
      personalCalendarAvailabilityBehavior: 'IGNORE',
      personalCalendarBusyDisplayMode: 'HIDDEN',
      personalCalendarApprovalRequired: false,
    })
    const eligibility = resolveCalendarConnectionSyncEligibility({
      workspacePolicy: policy,
      ownerMember: { id: 'member-1', role: 'MEMBER' },
      connection: {
        ownershipType: CalendarConnectionOwnershipType.MEMBER,
        connectionPurpose: CalendarConnectionPurpose.PERSONAL,
        visibilityMode: ExternalCalendarVisibilityMode.BUSY_ONLY,
        availabilityBehavior: 'IGNORE',
        busyDisplayMode: 'HIDDEN',
        approvalStatus: CalendarConnectionApprovalStatus.APPROVED,
        syncStatus: CalendarConnectionStatus.CONNECTED,
        disabledAt: null,
        disabledReason: null,
        ownerInactiveAt: null,
        disconnectedAt: null,
      },
    })

    expect(eligibility.canPull).toBe(true)
    expect(eligibility.contributesToBusy).toBe(false)
    expect(eligibility.reasonCode).toBe('personalCalendarIgnored')
  })

  it('respects member read-only policy when coercing sync directions', () => {
    const policy = normalizeWorkspaceCalendarConnectionPolicy({
      allowMemberConnections: true,
      allowMemberReadOnlySync: true,
      allowMemberTwoWaySync: false,
      allowMemberWriteOnlySync: false,
    })
    const direction = coerceCalendarSyncDirectionForPolicy({
      direction: CalendarSyncDirection.TWO_WAY,
      policy,
      connection: {
        ownershipType: CalendarConnectionOwnershipType.MEMBER,
      },
    })

    expect(direction).toBe(CalendarSyncDirection.AVAILABILITY_ONLY)
  })

  it('sanitizes busy-only external events before they enter Skillify', () => {
    const event = sanitizeExternalCalendarEvent({
      visibilityMode: ExternalCalendarVisibilityMode.BUSY_ONLY,
      providerEvent: {
        id: 'provider-event-1',
        calendarId: 'calendar-1',
        title: 'Private sales call',
        description: 'Sensitive notes',
        location: 'Customer HQ',
        attendees: [{ email: 'customer@example.com' }],
        startsAtUtc: '2026-07-28T14:00:00.000Z',
        endsAtUtc: '2026-07-28T15:00:00.000Z',
        timezone: 'America/New_York',
        visibility: 'public',
      },
    })

    expect(event.title).toBe('Busy')
    expect(event.description).toBeUndefined()
    expect(event.location).toBeUndefined()
    expect(event.attendees).toEqual([])
  })

  it('keeps provider-private events busy-only even when full details are allowed', () => {
    const event = sanitizeExternalCalendarEvent({
      visibilityMode: ExternalCalendarVisibilityMode.FULL_DETAILS,
      providerEvent: {
        id: 'provider-event-2',
        calendarId: 'calendar-1',
        title: 'Confidential interview',
        description: 'Private notes',
        startsAtUtc: '2026-07-28T14:00:00.000Z',
        endsAtUtc: '2026-07-28T15:00:00.000Z',
        timezone: 'America/New_York',
        visibility: 'private',
      },
    })

    expect(event.title).toBe('Busy')
    expect(event.description).toBeUndefined()
  })
})

describe('scheduling provider configuration', () => {
  it('keeps native persistence enabled when external provider credentials are absent', () => {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET
    delete process.env.GOOGLE_CALENDAR_REDIRECT_URI
    process.env.GOOGLE_CALENDAR_SYNC_ENABLED = 'true'

    const summary = getSchedulingIntegrationSummary()

    expect(summary.nativePersistenceEnabled).toBe(true)
    expect(getSchedulingProviderConfig('google').status).toBe('notConfigured')
  })

  it('reports enabled providers as encryptionMissing when credentials exist but encryption is absent', () => {
    process.env.GOOGLE_CALENDAR_SYNC_ENABLED = 'true'
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'secret'
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = 'https://skillify.test/oauth'
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY

    expect(getSchedulingProviderConfig('google').status).toBe(
      'encryptionMissing',
    )
  })

  it('returns structured unavailable results from provider adapters without network calls', async () => {
    process.env.MICROSOFT_CALENDAR_SYNC_ENABLED = 'false'

    const adapter = getSchedulingProviderAdapter('microsoft')
    const result = await adapter.listCalendars({ workspaceId: 'workspace-1' })

    expect(result).toEqual({
      ok: false,
      code: 'disabled',
      safeMessage:
        'Microsoft Outlook calendar listing is unavailable because provider status is disabled.',
      retryable: false,
    })
  })

  it('enables Google Calendar and credential-only CalDAV when encryption is configured', () => {
    process.env.GOOGLE_CALENDAR_SYNC_ENABLED = 'true'
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'google-client'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'google-secret'
    process.env.GOOGLE_CALENDAR_REDIRECT_URI =
      'https://skillify.test/api/scheduling/google/callback'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    )
    delete process.env.MICROSOFT_CALENDAR_SYNC_ENABLED

    const registry = getSchedulingProviderRegistry()

    expect(registry.find((entry) => entry.key === 'google')).toMatchObject({
      enabled: true,
      status: 'available',
    })
    expect(registry.find((entry) => entry.key === 'microsoft')).toMatchObject({
      enabled: false,
      status: 'disabled',
    })
    expect(registry.find((entry) => entry.key === 'appleIcloud')).toMatchObject(
      {
        enabled: false,
        status: 'disabled',
      },
    )
    expect(registry.find((entry) => entry.key === 'caldav')).toMatchObject({
      enabled: true,
      status: 'available',
    })
    expect(
      registry.find((entry) => entry.key === 'caldav')?.capabilities,
    ).toEqual(
      expect.arrayContaining(['basicAuth', 'calendarDiscovery', 'pollingSync']),
    )
    expect(registry.find((entry) => entry.key === 'ics')).toMatchObject({
      enabled: false,
      status: 'disabled',
    })
  })

  it('enables Microsoft Outlook in the provider registry when credentials are configured', () => {
    process.env.MICROSOFT_CALENDAR_SYNC_ENABLED = 'true'
    process.env.MICROSOFT_CALENDAR_CLIENT_ID = 'microsoft-client'
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = 'microsoft-secret'
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI =
      'https://skillify.test/api/scheduling/microsoft/callback'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    )

    const registry = getSchedulingProviderRegistry()

    expect(registry.find((entry) => entry.key === 'microsoft')).toMatchObject({
      enabled: true,
      status: 'available',
      capabilities: expect.arrayContaining([
        'oauth',
        'calendarDiscovery',
        'incrementalSync',
        'pushSync',
        'watchChannels',
        'recurrence',
        'webhooks',
      ]),
    })
  })

  it('builds a Google OAuth authorization URL with scheduling scopes and opaque state', () => {
    process.env.GOOGLE_CALENDAR_SYNC_ENABLED = 'true'
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'google-client'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'google-secret'
    process.env.GOOGLE_CALENDAR_REDIRECT_URI =
      'https://skillify.test/api/scheduling/google/callback'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    )

    const adapter = getSchedulingProviderAdapter('google')
    const result = adapter.connect({
      workspaceId: 'workspace-1',
      state: 'oauth-state-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const authorizationUrl = new URL(result.value.authorizationUrl)
    const state = JSON.parse(authorizationUrl.searchParams.get('state') ?? '{}')
    expect(authorizationUrl.hostname).toBe('accounts.google.com')
    expect(authorizationUrl.searchParams.get('client_id')).toBe('google-client')
    expect(state).toEqual({
      workspaceId: 'workspace-1',
      state: 'oauth-state-1',
    })
    expect(authorizationUrl.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/calendar.events',
    )
    expect(authorizationUrl.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/calendar.readonly',
    )
  })

  it('includes WorkspaceMember ownership in Google OAuth state when provided', () => {
    process.env.GOOGLE_CALENDAR_SYNC_ENABLED = 'true'
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'google-client'
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'google-secret'
    process.env.GOOGLE_CALENDAR_REDIRECT_URI =
      'https://skillify.test/api/scheduling/google/callback'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    )

    const adapter = getSchedulingProviderAdapter('google')
    const result = adapter.connect({
      workspaceId: 'workspace-1',
      workspaceMemberId: 'workspace-member-1',
      state: 'oauth-state-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const authorizationUrl = new URL(result.value.authorizationUrl)
    const state = JSON.parse(authorizationUrl.searchParams.get('state') ?? '{}')
    expect(state).toEqual({
      workspaceId: 'workspace-1',
      workspaceMemberId: 'workspace-member-1',
      state: 'oauth-state-1',
    })
  })

  it('builds a Microsoft OAuth authorization URL with offline calendar scopes and opaque state', () => {
    process.env.MICROSOFT_CALENDAR_SYNC_ENABLED = 'true'
    process.env.MICROSOFT_CALENDAR_CLIENT_ID = 'microsoft-client'
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = 'microsoft-secret'
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI =
      'https://skillify.test/api/scheduling/microsoft/callback'
    process.env.MICROSOFT_CALENDAR_TENANT_ID = 'organizations'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    )

    const adapter = getSchedulingProviderAdapter('microsoft')
    const result = adapter.connect({
      workspaceId: 'workspace-1',
      state: 'oauth-state-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const authorizationUrl = new URL(result.value.authorizationUrl)
    const state = JSON.parse(authorizationUrl.searchParams.get('state') ?? '{}')
    expect(authorizationUrl.hostname).toBe('login.microsoftonline.com')
    expect(authorizationUrl.pathname).toBe(
      '/organizations/oauth2/v2.0/authorize',
    )
    expect(authorizationUrl.searchParams.get('client_id')).toBe(
      'microsoft-client',
    )
    expect(state).toEqual({
      workspaceId: 'workspace-1',
      state: 'oauth-state-1',
    })
    expect(authorizationUrl.searchParams.get('scope')).toContain(
      'offline_access',
    )
    expect(authorizationUrl.searchParams.get('scope')).toContain(
      'Calendars.ReadWrite',
    )
  })

  it('includes WorkspaceMember ownership in Microsoft OAuth state when provided', () => {
    process.env.MICROSOFT_CALENDAR_SYNC_ENABLED = 'true'
    process.env.MICROSOFT_CALENDAR_CLIENT_ID = 'microsoft-client'
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = 'microsoft-secret'
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI =
      'https://skillify.test/api/scheduling/microsoft/callback'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    )

    const adapter = getSchedulingProviderAdapter('microsoft')
    const result = adapter.connect({
      workspaceId: 'workspace-1',
      workspaceMemberId: 'workspace-member-1',
      state: 'oauth-state-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const authorizationUrl = new URL(result.value.authorizationUrl)
    const state = JSON.parse(authorizationUrl.searchParams.get('state') ?? '{}')
    expect(state).toEqual({
      workspaceId: 'workspace-1',
      workspaceMemberId: 'workspace-member-1',
      state: 'oauth-state-1',
    })
  })

  it('normalizes Microsoft Graph calendar discovery responses', async () => {
    process.env.MICROSOFT_CALENDAR_SYNC_ENABLED = 'true'
    process.env.MICROSOFT_CALENDAR_CLIENT_ID = 'microsoft-client'
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = 'microsoft-secret'
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI =
      'https://skillify.test/api/scheduling/microsoft/callback'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    )
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          value: [
            {
              id: 'calendar-1',
              name: 'Operations',
              canEdit: true,
              isDefaultCalendar: true,
              owner: { address: 'ops@example.com', name: 'Ops' },
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const adapter = getSchedulingProviderAdapter('microsoft')
    const result = await adapter.listCalendars({
      workspaceId: 'workspace-1',
      accessToken: 'access-token',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/calendars',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    )
    expect(result).toMatchObject({
      ok: true,
      value: [
        {
          id: 'calendar-1',
          name: 'Operations',
          isPrimary: true,
          isWritable: true,
          ownerEmail: 'ops@example.com',
        },
      ],
    })
  })

  it('normalizes Microsoft Graph delta events and stores delta links', async () => {
    process.env.MICROSOFT_CALENDAR_SYNC_ENABLED = 'true'
    process.env.MICROSOFT_CALENDAR_CLIENT_ID = 'microsoft-client'
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = 'microsoft-secret'
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI =
      'https://skillify.test/api/scheduling/microsoft/callback'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          value: [
            {
              id: 'event-1',
              subject: 'Proposal Review',
              start: {
                dateTime: '2026-07-30T14:00:00',
                timeZone: 'America/New_York',
              },
              end: {
                dateTime: '2026-07-30T15:00:00',
                timeZone: 'America/New_York',
              },
              location: { displayName: 'Office' },
              attendees: [
                {
                  emailAddress: {
                    address: 'customer@example.com',
                    name: 'Customer',
                  },
                  status: { response: 'accepted' },
                },
              ],
              '@odata.etag': 'etag-1',
              lastModifiedDateTime: '2026-07-29T12:00:00Z',
            },
          ],
          '@odata.deltaLink': 'https://graph.microsoft.com/delta-token',
        }),
        { status: 200 },
      ),
    )

    const adapter = getSchedulingProviderAdapter('microsoft')
    const result = await adapter.pullChanges({
      workspaceId: 'workspace-1',
      accessToken: 'access-token',
      calendarId: 'calendar-1',
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        nextSyncToken: 'https://graph.microsoft.com/delta-token',
        events: [
          {
            id: 'event-1',
            calendarId: 'calendar-1',
            title: 'Proposal Review',
            location: 'Office',
            timezone: 'America/New_York',
            providerEtag: 'etag-1',
            providerUpdatedAt: '2026-07-29T12:00:00Z',
            attendees: [
              {
                email: 'customer@example.com',
                name: 'Customer',
                responseStatus: 'accepted',
              },
            ],
          },
        ],
      },
    })
  })

  it('creates Microsoft Graph watch subscriptions for calendar events', async () => {
    process.env.MICROSOFT_CALENDAR_SYNC_ENABLED = 'true'
    process.env.MICROSOFT_CALENDAR_CLIENT_ID = 'microsoft-client'
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = 'microsoft-secret'
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI =
      'https://skillify.test/api/scheduling/microsoft/callback'
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    )
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'subscription-1',
          resource: '/me/calendars/calendar-1/events',
          expirationDateTime: '2026-07-29T13:00:00Z',
        }),
        { status: 200 },
      ),
    )

    const adapter = getSchedulingProviderAdapter('microsoft')
    const result = await adapter.watchCalendar({
      workspaceId: 'workspace-1',
      accessToken: 'access-token',
      calendarId: 'calendar-1',
      channelId: 'channel-1',
      webhookUrl: 'https://skillify.test/api/scheduling/microsoft/webhook',
      token: 'client-state',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/subscriptions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('/me/calendars/calendar-1/events'),
      }),
    )
    expect(result).toMatchObject({
      ok: true,
      value: {
        id: 'subscription-1',
        resourceId: '/me/calendars/calendar-1/events',
        token: 'client-state',
      },
    })
  })
})

describe('Google Calendar recurrence and conflict mapping', () => {
  it('maps Skillify weekly recurrence rules into Google RRULE values', () => {
    expect(
      mapSkillifyRecurrenceToRRule({
        frequency: 'weekly',
        interval: 2,
        daysOfWeek: [1, 3, 5],
        endType: 'afterOccurrences',
        occurrenceCount: 6,
      }),
    ).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=6')
  })

  it('maps date-ended recurrence rules into Google UNTIL values', () => {
    expect(
      mapSkillifyRecurrenceToRRule({
        frequency: 'daily',
        interval: 1,
        endType: 'onDate',
        endDate: '2026-08-31',
      }),
    ).toBe('RRULE:FREQ=DAILY;UNTIL=20260831T000000Z')
  })

  it('detects provider-deleted external events as sync conflicts', () => {
    const conflict = detectCalendarSyncConflict({
      providerEvent: {
        calendarId: 'primary',
        id: 'google-event-1',
        title: 'Discovery Call',
        startsAtUtc: '2026-07-28T14:00:00.000Z',
        endsAtUtc: '2026-07-28T15:00:00.000Z',
        timezone: 'America/New_York',
        status: 'cancelled',
      },
      skillifyEventUpdatedAt: '2026-07-28T12:00:00.000Z',
      mappingProviderUpdatedAt: '2026-07-28T11:00:00.000Z',
      conflictPolicy: CalendarConflictPolicy.SKILLIFY_WINS,
    })

    expect(conflict).toMatchObject({
      type: 'providerDeleted',
      safeMessage: 'The Google Calendar event was deleted.',
    })
  })

  it('detects events changed in both Skillify and Google since the last sync', () => {
    const conflict = detectCalendarSyncConflict({
      providerEvent: {
        calendarId: 'primary',
        id: 'google-event-1',
        title: 'Discovery Call',
        startsAtUtc: '2026-07-28T14:00:00.000Z',
        endsAtUtc: '2026-07-28T15:00:00.000Z',
        timezone: 'America/New_York',
        providerUpdatedAt: '2026-07-28T13:00:00.000Z',
      },
      skillifyEventUpdatedAt: '2026-07-28T13:30:00.000Z',
      mappingProviderUpdatedAt: '2026-07-28T12:00:00.000Z',
      conflictPolicy: CalendarConflictPolicy.ASK_USER,
    })

    expect(conflict).toMatchObject({
      type: 'changedBothPlaces',
      safeMessage:
        'This event changed in Skillify and Google Calendar since the last sync.',
    })
  })

  it('resolves provider conflicts according to the configured policy', () => {
    expect(
      resolveCalendarConflictByPolicy({
        conflictType: 'changedBothPlaces',
        policy: CalendarConflictPolicy.ASK_USER,
      }),
    ).toEqual({
      resolution: 'askUser',
      shouldApplyProvider: false,
      shouldApplySkillify: false,
    })
    expect(
      resolveCalendarConflictByPolicy({
        conflictType: 'providerDeleted',
        policy: CalendarConflictPolicy.PROVIDER_WINS,
      }),
    ).toEqual({
      resolution: 'acceptProviderDelete',
      shouldApplyProvider: true,
      shouldApplySkillify: false,
    })
  })
})

describe('Google Calendar Phase 3.5 sync hardening', () => {
  const providerEvent = {
    id: 'google-event-1',
    calendarId: 'primary',
    title: 'Discovery Call',
    description: 'Discuss onboarding',
    startsAtUtc: '2026-07-28T14:00:00.000Z',
    endsAtUtc: '2026-07-28T15:00:00.000Z',
    timezone: 'America/New_York',
    location: 'Zoom',
    providerEtag: 'etag-1',
    providerUpdatedAt: '2026-07-28T13:00:00.000Z',
  }

  it('scores likely duplicates deterministically even without provider IDs', () => {
    const candidate = scoreGoogleDuplicateCandidate({
      providerEvent: { ...providerEvent, id: undefined },
      skillifyEvent: event({
        startsAt: providerEvent.startsAtUtc,
        endsAt: providerEvent.endsAtUtc,
        description: 'Discuss onboarding',
        locationLabel: 'Zoom',
        updatedAt: '2026-07-28T12:00:00.000Z',
      }),
    })

    expect(candidate.score).toBeGreaterThanOrEqual(85)
    expect(candidate.confidence).toBe('high')
    expect(candidate.reasons).toContain('Title matches.')
    expect(candidate.reasons).toContain('Start time matches.')
  })

  it('creates dry-run import previews with imports, exports, duplicates, and skips', () => {
    const skillifyEvent = event({
      id: 'skillify-event-1',
      description: 'Discuss onboarding',
      locationLabel: 'Zoom',
    })
    const preview = createGoogleImportPreview({
      skillifyEvents: [
        skillifyEvent,
        event({
          id: 'skillify-export-1',
          title: 'Skillify-only planning',
          startsAt: '2026-07-29T14:00:00.000Z',
          endsAt: '2026-07-29T15:00:00.000Z',
        }),
      ],
      googleEvents: [
        providerEvent,
        {
          ...providerEvent,
          id: 'google-import-1',
          title: 'Google-only review',
          startsAtUtc: '2026-07-30T14:00:00.000Z',
          endsAtUtc: '2026-07-30T15:00:00.000Z',
        },
        {
          ...providerEvent,
          id: undefined,
          title: 'Missing provider id',
        },
      ],
      mappings: [
        {
          providerEventId: 'google-event-1',
          schedulingEventId: 'skillify-event-1',
        },
      ],
    })

    expect(preview.existingSkillifyEvents).toBe(2)
    expect(preview.existingGoogleEvents).toBe(3)
    expect(
      preview.duplicates.some((entry) => entry.confidence === 'high'),
    ).toBe(true)
    expect(preview.eventsToImport.map((entry) => entry.id)).toEqual([
      'google-import-1',
    ])
    expect(preview.eventsToExport.map((entry) => entry.id)).toEqual([
      'skillify-export-1',
    ])
    expect(preview.eventsSkipped).toHaveLength(1)
  })

  it('builds deterministic merge plans and requires choice for same-field edits', () => {
    const plan = buildGoogleConflictMergePlan({
      skillifyCurrent: {
        title: 'Discovery Call',
        location: 'Conference Room',
        description: 'Skillify notes',
      },
      providerCurrent: {
        title: 'Discovery Call',
        location: 'Zoom',
        description: 'Google notes',
      },
      skillifyBaseline: {
        title: 'Discovery Call',
        location: 'Conference Room',
        description: 'Original notes',
      },
      providerBaseline: {
        title: 'Discovery Call',
        location: 'Conference Room',
        description: 'Original notes',
      },
    })

    expect(plan.mergeable).toBe(false)
    expect(plan.requiresUserChoice).toContain('description')
    expect(plan.mergedFields.location).toBe('Zoom')
  })

  it('detects provider echo loops by etag or stable sync hash', () => {
    expect(
      shouldIgnoreGoogleProviderLoop({
        mapping: {
          lastSyncOrigin: 'skillify',
          originOperation: 'skillify.export',
          providerEtag: 'etag-1',
          syncHash: null,
        },
        providerEvent,
      }),
    ).toBe(true)

    const syncHash = computeGoogleSyncHash({
      title: providerEvent.title,
      startsAtUtc: providerEvent.startsAtUtc,
      endsAtUtc: providerEvent.endsAtUtc,
      timezone: providerEvent.timezone,
      location: providerEvent.location,
      description: providerEvent.description,
      recurrence: undefined,
    })
    expect(
      shouldIgnoreGoogleProviderLoop({
        mapping: {
          lastSyncOrigin: 'skillify',
          originOperation: 'skillify.export',
          providerEtag: null,
          syncHash,
        },
        providerEvent,
      }),
    ).toBe(true)
  })

  it('classifies webhook replay, stale, expiration, and mismatch cases', () => {
    expect(
      classifyGoogleWebhookDelivery({
        channelResourceId: 'resource-1',
        receivedResourceId: 'resource-1',
        lastMessageNumber: '10',
        messageNumber: '10',
      }),
    ).toEqual({ action: 'ignore', reason: 'duplicateDelivery' })
    expect(
      classifyGoogleWebhookDelivery({
        channelResourceId: 'resource-1',
        receivedResourceId: 'resource-2',
      }),
    ).toEqual({ action: 'ignore', reason: 'resourceMismatch' })
    expect(
      classifyGoogleWebhookDelivery({
        expiresAt: new Date('2026-07-28T10:00:00.000Z'),
        now: new Date('2026-07-28T11:00:00.000Z'),
      }),
    ).toEqual({ action: 'ignore', reason: 'expiredChannel' })
    expect(
      classifyGoogleWebhookDelivery({
        lastMessageNumber: '10',
        messageNumber: '11',
      }),
    ).toEqual({ action: 'process', reason: 'newDelivery' })
  })

  it('finds mapping integrity risks and repair candidates', () => {
    const findings = inspectGoogleMappingIntegrity({
      mappings: [
        {
          id: 'mapping-1',
          providerEventId: 'google-event-1',
          schedulingEventId: 'missing-event',
          connectedCalendarId: 'calendar-1',
          recurrenceSeriesId: null,
          occurrenceId: null,
        },
        {
          id: 'mapping-2',
          providerEventId: 'google-event-2',
          schedulingEventId: 'skillify-event-1',
          connectedCalendarId: 'calendar-1',
          recurrenceSeriesId: null,
          occurrenceId: null,
        },
        {
          id: 'mapping-3',
          providerEventId: 'google-event-3',
          schedulingEventId: 'skillify-event-1',
          connectedCalendarId: 'calendar-1',
          recurrenceSeriesId: null,
          occurrenceId: null,
        },
        {
          id: 'mapping-4',
          providerEventId: 'google-event-4',
          schedulingEventId: 'skillify-event-2',
          connectedCalendarId: 'calendar-1',
          recurrenceSeriesId: null,
          occurrenceId: '2026-07-28T14:00:00.000Z',
        },
      ],
      knownSkillifyEventIds: new Set(['skillify-event-1']),
    })

    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'missingSkillifyEvent',
        'multipleProviderEvents',
        'occurrenceSeriesMismatch',
      ]),
    )
    expect(
      findings.find((finding) => finding.code === 'missingSkillifyEvent')
        ?.repairable,
    ).toBe(true)
  })
})

describe('scheduling status and availability semantics', () => {
  it('centralizes lifecycle statuses that consume availability', () => {
    expect(doesSchedulingStatusConsumeAvailability('scheduled')).toBe(true)
    expect(doesSchedulingStatusConsumeAvailability('confirmed')).toBe(true)
    expect(doesSchedulingStatusConsumeAvailability('inProgress')).toBe(true)
    expect(doesSchedulingStatusConsumeAvailability('completed')).toBe(false)
    expect(doesSchedulingStatusConsumeAvailability('canceled')).toBe(false)
    expect(doesSchedulingStatusConsumeAvailability('missed')).toBe(false)
  })

  it('returns effects for completed and canceled transitions', () => {
    expect(
      getSchedulingStatusTransitionEffect({
        from: 'inProgress',
        to: 'completed',
      }),
    ).toMatchObject({
      consumesAvailability: false,
      shouldCancelProviderEvent: false,
      completedAt: true,
    })

    expect(
      getSchedulingStatusTransitionEffect({
        from: 'confirmed',
        to: 'canceled',
      }),
    ).toMatchObject({
      consumesAvailability: false,
      shouldCancelProviderEvent: true,
      canceledAt: true,
    })
  })

  it('rejects unsupported lifecycle jumps', () => {
    expect(
      canTransitionSchedulingEventStatus({
        from: 'completed',
        to: 'inProgress',
      }),
    ).toBe(false)
  })

  it('keeps in-progress events consuming availability after the scheduled end', () => {
    expect(
      doesSchedulingEventConsumeAvailability({
        event: event({
          status: 'inProgress',
          endsAt: '2026-07-27T13:00:00.000Z',
        }),
        workspaceNow: new Date('2026-07-27T14:00:00.000Z'),
      }),
    ).toBe(true)
  })

  it('excludes stale scheduled events that already ended', () => {
    expect(
      doesSchedulingEventConsumeAvailability({
        event: event({
          status: 'scheduled',
          endsAt: '2026-07-27T13:00:00.000Z',
        }),
        workspaceNow: new Date('2026-07-27T14:00:00.000Z'),
      }),
    ).toBe(false)
  })

  it('detects member conflicts and uses occurrence times for recurring events', () => {
    const recurringOccurrence: SchedulingOccurrence = {
      ...event({
        id: 'event-2',
        title: 'Recurring Review',
        startsAt: '2026-07-01T14:00:00.000Z',
        endsAt: '2026-07-01T15:00:00.000Z',
      }),
      occurrenceId: 'event-2:2026-07-27',
      sourceEventId: 'event-2',
      occurrenceStartsAt: '2026-07-27T14:30:00.000Z',
      occurrenceEndsAt: '2026-07-27T15:30:00.000Z',
      isRecurringOccurrence: true,
    }

    expect(
      findSchedulingAvailabilityConflicts({
        candidate: event({ id: 'event-1' }),
        existing: [recurringOccurrence],
        workspaceNow: new Date('2026-07-27T12:00:00.000Z'),
      }),
    ).toEqual([
      {
        eventId: 'event-2',
        occurrenceId: 'event-2:2026-07-27',
        title: 'Recurring Review',
        assignedMemberIds: ['member-1'],
        startsAt: '2026-07-27T14:30:00.000Z',
        endsAt: '2026-07-27T15:30:00.000Z',
      },
    ])
  })
})

describe('scheduling linked-record requirement rules', () => {
  const settings = normalizeSchedulingSettings({
    businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
    settings: {
      timezone: 'America/New_York',
      preset: 'consultative',
    },
  })
  const capabilities = getWorkspaceSchedulingCapabilities({
    businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
    settings,
  })

  it('uses one resolver for optional, required, and not-allowed linked records', () => {
    expect(
      resolveSchedulingLinkedRecordRule({
        eventType: 'discoveryCall',
        settings,
        capabilities,
      }),
    ).toMatchObject({
      requirement: 'optional',
      warnWhenUnlinked: true,
    })

    expect(
      resolveSchedulingLinkedRecordRule({
        eventType: 'proposalReview',
        settings,
        capabilities,
      }).requirement,
    ).toBe('required')

    expect(
      resolveSchedulingLinkedRecordRule({
        eventType: 'internalMeeting',
        settings,
        capabilities,
      }).requirement,
    ).toBe('notAllowed')
  })

  it('validates create and edit linked-record requirements consistently', () => {
    expect(
      validateSchedulingLinkedRecord({
        eventType: 'discoveryCall',
        settings,
        capabilities,
        linkedRecord: null,
      }),
    ).toEqual({ valid: true })

    expect(
      validateSchedulingLinkedRecord({
        eventType: 'proposalReview',
        settings,
        capabilities,
        linkedRecord: null,
      }),
    ).toEqual({
      valid: false,
      message: 'Select a linked record for this event type.',
    })

    expect(
      validateSchedulingLinkedRecord({
        eventType: 'internalMeeting',
        settings,
        capabilities,
        linkedRecord: null,
      }),
    ).toEqual({ valid: true })
  })

  it('rejects scheduling event timestamp ranges where end is not later than start', () => {
    expect(() =>
      validateSchedulingEventTimestampRange({
        startsAt: '2026-07-27T16:00:00.000Z',
        endsAt: '2026-07-27T15:00:00.000Z',
      }),
    ).toThrow(SchedulingEventTimeValidationError)

    try {
      validateSchedulingEventTimestampRange({
        startsAt: '2026-07-27T16:00:00.000Z',
        endsAt: '2026-07-27T16:00:00.000Z',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(SchedulingEventTimeValidationError)
      expect((error as SchedulingEventTimeValidationError).fieldErrors).toEqual(
        {
          endTime: 'End time must be later than start time.',
        },
      )
    }

    expect(() =>
      validateSchedulingEventTimestampRange({
        startsAt: '2026-07-27T16:00:00.000Z',
        endsAt: '2026-07-27T17:00:00.000Z',
      }),
    ).not.toThrow()
  })
})

describe('scheduling outbox events', () => {
  it('creates domain and sync-request outbox records for scheduling event changes', () => {
    const outboxEvents = createSchedulingEventChangedOutboxEvents({
      workspaceId: 'workspace-1',
      eventId: 'event-1',
      action: 'updated',
      payload: { title: 'Proposal Review' },
    })

    expect(outboxEvents.map((record) => record.topic)).toEqual([
      'scheduling.event.updated',
      'scheduling.sync.requested',
    ])
    expect(outboxEvents).toHaveLength(2)
    expect(outboxEvents.every((record) => record.status === 'pending')).toBe(
      true,
    )
  })
})
