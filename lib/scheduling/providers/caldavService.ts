import {
  CalendarConnectionStatus,
  CalendarConnectionOwnershipType,
  CalendarConnectionPurpose,
  CalendarPurposeClassificationSource,
  CalendarEventOwnership,
  CalendarEventSyncState,
  CalendarProvider as PrismaCalendarProvider,
  CalendarSyncDirection,
  CalendarSyncDirectionLog,
  CalendarSyncLogStatus,
  CalendarSyncConflictStatus,
  type Prisma,
  type CalendarConnection,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import { encryptToken, decryptToken } from '@/lib/integrations/crypto'
import { schedulingRepository } from '@/lib/scheduling/repository'
import { getSchedulingProviderConfig } from '@/lib/scheduling/providers/config'
import {
  createCalDavCalendarProvider,
  discoverCalDavAccount,
  getCalDavPlatformPreset,
  normalizeCalDavPlatform,
  normalizeCalDavServerUrl,
  type CalDavPlatform,
} from '@/lib/scheduling/providers/caldav'
import type {
  ProviderCalendar,
  ProviderEventPayload,
} from '@/lib/scheduling/providers/types'
import { mapSchedulingEventToGooglePayload } from '@/lib/scheduling/providers/recurrenceMapping'
import { detectCalendarSyncConflict } from '@/lib/scheduling/providers/syncEngine'
import {
  computeGoogleSyncHash,
  createGoogleImportPreview,
  inspectGoogleMappingIntegrity,
  shouldIgnoreGoogleProviderLoop,
} from '@/lib/scheduling/providers/googleSyncHardening'
import {
  classifyCalendarConnectionPurpose,
  getMemberConnectionInitialGovernance,
  getWorkspaceCalendarConnectionPolicy,
  getWorkspaceConnectionInitialGovernance,
  resolveCalendarConnectionSyncEligibility,
  resolvePersonalCalendarAccess,
  sanitizeExternalCalendarEvent,
  toPersonalCalendarAvailabilityBehaviorPrisma,
  toPersonalCalendarBusyDisplayModePrisma,
} from '@/lib/scheduling/providers/calendarGovernance'

const CALDAV_PROVIDER = PrismaCalendarProvider.CALDAV

function decryptNullable(value?: string | null) {
  return value ? decryptToken(value) : undefined
}

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined
  return value as Prisma.InputJsonValue
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toCalendarSyncDirection(value: string | undefined) {
  if (value === 'EXPORT_ONLY') return CalendarSyncDirection.EXPORT_ONLY
  if (value === 'TWO_WAY') return CalendarSyncDirection.TWO_WAY
  if (value === 'AVAILABILITY_ONLY')
    return CalendarSyncDirection.AVAILABILITY_ONLY
  if (value === 'DISABLED') return CalendarSyncDirection.DISABLED
  return CalendarSyncDirection.IMPORT_ONLY
}

function providerEventToSchedulingInput(providerEvent: ProviderEventPayload) {
  return {
    title: providerEvent.title || 'Untitled CalDAV event',
    description: providerEvent.description,
    type: 'internalMeeting' as const,
    status:
      providerEvent.status === 'cancelled'
        ? ('canceled' as const)
        : ('scheduled' as const),
    startsAt: providerEvent.startsAtUtc,
    endsAt: providerEvent.endsAtUtc,
    allDay: providerEvent.allDay ?? false,
    timezone: providerEvent.timezone,
    locationType: providerEvent.location
      ? ('other' as const)
      : ('none' as const),
    location: providerEvent.location,
    locationLabel: providerEvent.location,
    assignedMemberIds: [],
    linkedRecord: null,
    externalCalendarState: 'synced' as const,
  }
}

function isWritableCalendar(calendar: ProviderCalendar) {
  return (
    calendar.isWritable === true ||
    ['owner', 'writer'].includes(calendar.accessRole ?? '')
  )
}

function displayPlatformLabel(platform: CalDavPlatform) {
  return getCalDavPlatformPreset(platform).label
}

async function loadCalDavContext(connection: CalendarConnection) {
  const metadata = metadataRecord(connection.metadata)
  return {
    workspaceId: connection.workspaceId,
    connectionId: connection.id,
    accessToken: decryptNullable(connection.accessTokenEncrypted),
    username:
      typeof metadata.username === 'string'
        ? metadata.username
        : connection.accountEmail,
    metadata,
  }
}

async function persistDiscoveredCalendars({
  workspaceId,
  connectionId,
  calendars,
}: {
  workspaceId: string
  connectionId: string
  calendars: ProviderCalendar[]
}) {
  const connection = await prisma.calendarConnection.findUnique({
    where: { id: connectionId },
  })
  if (!connection) return
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  for (const calendar of calendars) {
    const classification = classifyCalendarConnectionPurpose({
      provider: 'caldav',
      providerEmail: calendar.ownerEmail ?? connection.accountEmail,
      providerCalendarMetadata: calendar.raw,
      ownershipType: connection.ownershipType,
    })
    const calendarPurpose =
      connection.connectionPurpose !== CalendarConnectionPurpose.UNKNOWN
        ? connection.connectionPurpose
        : classification.purpose
    const syncDirection: CalendarSyncDirection =
      calendarPurpose === CalendarConnectionPurpose.PERSONAL
        ? CalendarSyncDirection.AVAILABILITY_ONLY
        : CalendarSyncDirection.IMPORT_ONLY
    const writable = isWritableCalendar(calendar)
    await prisma.connectedCalendar.upsert({
      where: {
        connectionId_providerCalendarId: {
          connectionId,
          providerCalendarId: calendar.id,
        },
      },
      create: {
        workspaceId,
        connectionId,
        providerCalendarId: calendar.id,
        calendarPurpose,
        classificationSource: classification.source,
        classificationConfidence: classification.confidence,
        classifiedAt: new Date(),
        availabilityBehavior:
          calendarPurpose === CalendarConnectionPurpose.PERSONAL
            ? toPersonalCalendarAvailabilityBehaviorPrisma(
                workspacePolicy.personalCalendarAvailabilityBehavior,
              )
            : connection.availabilityBehavior,
        busyDisplayMode:
          calendarPurpose === CalendarConnectionPurpose.PERSONAL
            ? toPersonalCalendarBusyDisplayModePrisma(
                workspacePolicy.personalCalendarBusyDisplayMode,
              )
            : connection.busyDisplayMode,
        name: calendar.name,
        ownerEmail: calendar.ownerEmail,
        description: calendar.description,
        color: calendar.color,
        timezone: calendar.timezone,
        accessRole: calendar.accessRole,
        visibility: calendar.visibility,
        isPrimary: calendar.isPrimary ?? false,
        isWritable: writable,
        selectedForSync: calendar.isPrimary ?? false,
        importEnabled: true,
        exportEnabled: false,
        defaultExportTarget: (calendar.isPrimary ?? false) && writable,
        syncDirection,
        metadata: jsonInput(calendar.raw),
      },
      update: {
        name: calendar.name,
        calendarPurpose,
        classificationSource: classification.source,
        classificationConfidence: classification.confidence,
        ownerEmail: calendar.ownerEmail,
        description: calendar.description,
        color: calendar.color,
        timezone: calendar.timezone,
        accessRole: calendar.accessRole,
        visibility: calendar.visibility,
        isPrimary: calendar.isPrimary ?? false,
        isWritable: writable,
        metadata: jsonInput(calendar.raw),
      },
    })
  }
}

export async function listCalDavCalendarIntegrationState({
  workspaceId,
  actorWorkspaceMemberId,
  canManageScheduling = false,
  platform,
}: {
  workspaceId: string
  actorWorkspaceMemberId?: string
  canManageScheduling?: boolean
  platform?: CalDavPlatform
}) {
  const providerConfig = getSchedulingProviderConfig('caldav')
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const whereMetadata = platform
    ? { path: ['platform'], equals: platform }
    : undefined
  const [connections, actorMembership] = await Promise.all([
    prisma.calendarConnection.findMany({
      where: {
        workspaceId,
        provider: CALDAV_PROVIDER,
        ...(whereMetadata ? { metadata: whereMetadata } : {}),
      },
      include: {
        calendars: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        watchChannels: { orderBy: { updatedAt: 'desc' }, take: 10 },
        syncLogs: { orderBy: { startedAt: 'desc' }, take: 10 },
        conflicts: {
          where: { status: 'OPEN' },
          orderBy: { detectedAt: 'desc' },
          take: 10,
        },
        workspaceMember: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        connectedByWorkspaceMember: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    actorWorkspaceMemberId
      ? prisma.workspaceMember.findFirst({
          where: { workspaceId, id: actorWorkspaceMemberId },
          select: { id: true, role: true },
        })
      : Promise.resolve(null),
  ])
  const pendingSync = await prisma.calendarEventMapping.count({
    where: {
      workspaceId,
      syncState: {
        in: [
          CalendarEventSyncState.PENDING_PULL,
          CalendarEventSyncState.PENDING_PUSH,
          CalendarEventSyncState.FAILED,
          CalendarEventSyncState.CONFLICT,
        ],
      },
    },
  })
  return {
    provider: {
      key: 'caldav',
      label: platform ? displayPlatformLabel(platform) : providerConfig.label,
      status: providerConfig.status,
      syncEnabled: providerConfig.syncEnabled,
      missing: providerConfig.missing,
    },
    policy: {
      ...workspacePolicy,
      memberConnectionsAllowed: workspacePolicy.allowMemberConnections,
      multipleAccountsPerMemberAllowed:
        workspacePolicy.allowMultipleAccountsPerMember,
      sharedConnectionsAllowed: workspacePolicy.allowWorkspaceConnections,
      requireAdminApproval: workspacePolicy.requireMemberConnectionApproval,
      defaultPersonalVisibilityMode:
        workspacePolicy.defaultMemberVisibilityMode,
      defaultWorkspaceVisibilityMode:
        workspacePolicy.defaultWorkspaceVisibilityMode,
      personalCalendarAccess: actorWorkspaceMemberId
        ? resolvePersonalCalendarAccess({
            workspacePolicy,
            workspaceMember: actorMembership,
          })
        : null,
    },
    currentMember: actorWorkspaceMemberId
      ? { id: actorWorkspaceMemberId }
      : null,
    connections: connections.map((connection) => {
      const syncEligibility = resolveCalendarConnectionSyncEligibility({
        connection,
        workspacePolicy,
        ownerMember: connection.workspaceMember,
        providerHealth: providerConfig.status,
      })
      const metadata = metadataRecord(connection.metadata)
      return {
        id: connection.id,
        accountEmail: connection.accountEmail,
        displayName: connection.displayName,
        providerAccountId: connection.providerAccountId,
        ownershipType: connection.ownershipType,
        connectionPurpose: connection.connectionPurpose,
        classificationSource: connection.classificationSource,
        classificationConfidence: connection.classificationConfidence,
        classifiedAt: connection.classifiedAt?.toISOString() ?? null,
        adminConfirmedAt: connection.adminConfirmedAt?.toISOString() ?? null,
        platform: metadata.platform,
        serverUrl: metadata.serverUrl,
        classificationConfirmation: metadata.classificationConfirmation ?? null,
        availabilityBehavior: connection.availabilityBehavior,
        busyDisplayMode: connection.busyDisplayMode,
        visibilityMode: connection.visibilityMode,
        approvalStatus: connection.approvalStatus,
        disabledAt: connection.disabledAt?.toISOString() ?? null,
        disabledReason: connection.disabledReason,
        ownerInactiveAt: connection.ownerInactiveAt?.toISOString() ?? null,
        tokenStatus: connection.tokenStatus,
        ownerMember: connection.workspaceMember
          ? {
              id: connection.workspaceMember.id,
              name:
                connection.workspaceMember.user.fullName ??
                connection.workspaceMember.user.email ??
                'Workspace member',
              email: connection.workspaceMember.user.email,
              isCurrentMember:
                connection.workspaceMember.id === actorWorkspaceMemberId,
            }
          : null,
        connectedByMember: connection.connectedByWorkspaceMember
          ? {
              id: connection.connectedByWorkspaceMember.id,
              name:
                connection.connectedByWorkspaceMember.user.fullName ??
                connection.connectedByWorkspaceMember.user.email ??
                'Workspace member',
              email: connection.connectedByWorkspaceMember.user.email,
              isCurrentMember:
                connection.connectedByWorkspaceMember.id ===
                actorWorkspaceMemberId,
            }
          : null,
        canManage:
          canManageScheduling ||
          (connection.ownershipType ===
            CalendarConnectionOwnershipType.MEMBER &&
            connection.workspaceMemberId === actorWorkspaceMemberId),
        syncEligibility,
        syncStatus: connection.syncStatus,
        conflictPolicy: connection.conflictPolicy,
        syncFrequencyMinutes: connection.syncFrequencyMinutes,
        lastSuccessfulSyncAt:
          connection.lastSuccessfulSyncAt?.toISOString() ?? null,
        lastAttemptedSyncAt:
          connection.lastAttemptedSyncAt?.toISOString() ?? null,
        nextSyncAt: connection.nextSyncAt?.toISOString() ?? null,
        lastErrorCode: connection.lastErrorCode,
        lastErrorMessage: connection.lastErrorMessage,
        calendars: connection.calendars.map((calendar) => ({
          id: calendar.id,
          providerCalendarId: calendar.providerCalendarId,
          name: calendar.name,
          ownerEmail: calendar.ownerEmail,
          timezone: calendar.timezone,
          color: calendar.color,
          accessRole: calendar.accessRole,
          isPrimary: calendar.isPrimary,
          isWritable: calendar.isWritable,
          selectedForSync: calendar.selectedForSync,
          syncDirection: calendar.syncDirection,
          defaultExportTarget: calendar.defaultExportTarget,
          calendarPurpose: calendar.calendarPurpose,
          classificationSource: calendar.classificationSource,
          classificationConfidence: calendar.classificationConfidence,
          availabilityBehavior: calendar.availabilityBehavior,
          busyDisplayMode: calendar.busyDisplayMode,
          lastSyncedAt: calendar.lastSyncedAt?.toISOString() ?? null,
          lastErrorCode: calendar.lastErrorCode,
          lastErrorMessage: calendar.lastErrorMessage,
        })),
        watchChannels: [],
        conflicts: connection.conflicts.map((conflict) => ({
          id: conflict.id,
          type: conflict.conflictType,
          safeMessage: conflict.safeMessage,
          detectedAt: conflict.detectedAt.toISOString(),
          providerSnapshot: conflict.providerSnapshot,
          skillifySnapshot: conflict.skillifySnapshot,
          metadata: conflict.metadata,
        })),
        openConflicts: connection.conflicts.length,
        recentLogs: connection.syncLogs.map((log) => ({
          id: log.id,
          operation: log.operation,
          direction: log.direction,
          status: log.status,
          safeMessage: log.safeMessage,
          startedAt: log.startedAt.toISOString(),
        })),
      }
    }),
    diagnostics: {
      pendingSync,
      connectedAccounts: connections.length,
      openConflicts: connections.reduce(
        (total, connection) => total + connection.conflicts.length,
        0,
      ),
      activeWatchChannels: 0,
      expiredWatchChannels: 0,
    },
  }
}

export async function connectCalDavCalendar({
  workspaceId,
  actorUserId,
  actorWorkspaceMemberId,
  ownershipType,
  requestedPurpose,
  platform: rawPlatform,
  serverUrl: rawServerUrl,
  username: rawUsername,
  password: rawPassword,
}: {
  workspaceId: string
  actorUserId: string
  actorWorkspaceMemberId: string
  ownershipType: CalendarConnectionOwnershipType
  requestedPurpose?: CalendarConnectionPurpose
  platform?: string
  serverUrl?: string
  username?: string
  password?: string
}) {
  const config = getSchedulingProviderConfig('caldav')
  if (config.status !== 'available') {
    return {
      ok: false as const,
      code: config.status,
      safeMessage:
        config.status === 'encryptionMissing'
          ? 'Calendar credential encryption is not configured.'
          : 'CalDAV sync is not available.',
      retryable: false,
    }
  }
  const platform = normalizeCalDavPlatform(rawPlatform)
  const serverUrl = normalizeCalDavServerUrl(rawServerUrl ?? '', platform)
  const username = rawUsername?.trim()
  const password = rawPassword?.trim()
  if (!username || !password) {
    return {
      ok: false as const,
      code: 'missingCredentials',
      safeMessage: 'Username and app password are required.',
      retryable: false,
    }
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const connectionPurpose =
    requestedPurpose ??
    (ownershipType === CalendarConnectionOwnershipType.WORKSPACE
      ? CalendarConnectionPurpose.WORKSPACE_SHARED
      : CalendarConnectionPurpose.PERSONAL)
  if (
    ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    !workspacePolicy.allowMemberConnections
  ) {
    return {
      ok: false as const,
      code: 'memberConnectionsDisabled',
      safeMessage:
        'This workspace does not currently allow members to connect personal calendars.',
      retryable: false,
    }
  }
  if (
    ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    !workspacePolicy.allowMultipleAccountsPerMember
  ) {
    const existingMemberConnection = await prisma.calendarConnection.findFirst({
      where: {
        workspaceId,
        provider: CALDAV_PROVIDER,
        ownershipType: CalendarConnectionOwnershipType.MEMBER,
        workspaceMemberId: actorWorkspaceMemberId,
        disconnectedAt: null,
      },
      select: { id: true },
    })
    if (existingMemberConnection) {
      return {
        ok: false as const,
        code: 'multipleAccountsDisabled',
        safeMessage:
          'This workspace allows only one personal CalDAV account per member.',
        retryable: false,
      }
    }
  }
  const ctx = {
    workspaceId,
    username,
    accessToken: password,
    metadata: { platform, serverUrl, username },
  }
  const discovery = await discoverCalDavAccount({ ctx, serverUrl })
  if (!discovery.ok) return discovery
  const initialGovernance =
    ownershipType === CalendarConnectionOwnershipType.MEMBER
      ? getMemberConnectionInitialGovernance(workspacePolicy, connectionPurpose)
      : getWorkspaceConnectionInitialGovernance(workspacePolicy)
  const providerAccountId = `${platform}:${serverUrl}:${username.toLowerCase()}`
  const connection = await prisma.calendarConnection.upsert({
    where: {
      workspaceId_provider_providerAccountId: {
        workspaceId,
        provider: CALDAV_PROVIDER,
        providerAccountId,
      },
    },
    create: {
      workspaceId,
      connectedByUserId: actorUserId,
      workspaceMemberId:
        ownershipType === CalendarConnectionOwnershipType.MEMBER
          ? actorWorkspaceMemberId
          : null,
      connectedByWorkspaceMemberId: actorWorkspaceMemberId,
      ownershipType,
      connectionPurpose,
      classificationSource: CalendarPurposeClassificationSource.MEMBER_SELECTED,
      classificationConfidence: 1,
      classifiedAt: new Date(),
      classifiedByWorkspaceMemberId: actorWorkspaceMemberId,
      visibilityMode: initialGovernance.visibilityMode,
      approvalStatus: initialGovernance.approvalStatus,
      availabilityBehavior: initialGovernance.availabilityBehavior,
      busyDisplayMode: initialGovernance.busyDisplayMode,
      provider: CALDAV_PROVIDER,
      providerAccountId,
      accountEmail: username.includes('@') ? username : null,
      displayName: `${displayPlatformLabel(platform)} · ${username}`,
      accessTokenEncrypted: encryptToken(password),
      refreshTokenEncrypted: null,
      scopes: jsonInput(['caldav.read', 'caldav.write']),
      syncStatus: CalendarConnectionStatus.CONNECTED,
      tokenStatus: 'valid',
      lastValidatedAt: new Date(),
      metadata: jsonInput({
        platform,
        serverUrl,
        username,
        principalUrl: discovery.value.principalUrl,
        calendarHomeSetUrl: discovery.value.calendarHomeSetUrl,
        capabilities: discovery.value.capabilities,
      }),
    },
    update: {
      connectedByUserId: actorUserId,
      connectedByWorkspaceMemberId: actorWorkspaceMemberId,
      ownershipType,
      connectionPurpose,
      accountEmail: username.includes('@') ? username : null,
      displayName: `${displayPlatformLabel(platform)} · ${username}`,
      accessTokenEncrypted: encryptToken(password),
      tokenStatus: 'valid',
      syncStatus: CalendarConnectionStatus.CONNECTED,
      disconnectedAt: null,
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: jsonInput({
        platform,
        serverUrl,
        username,
        principalUrl: discovery.value.principalUrl,
        calendarHomeSetUrl: discovery.value.calendarHomeSetUrl,
        capabilities: discovery.value.capabilities,
      }),
    },
    select: { id: true },
  })
  await persistDiscoveredCalendars({
    workspaceId,
    connectionId: connection.id,
    calendars: discovery.value.calendars,
  })
  return {
    ok: true as const,
    value: {
      connectionId: connection.id,
      calendars: discovery.value.calendars.length,
    },
  }
}

export async function discoverCalDavCalendars({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}) {
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: CALDAV_PROVIDER },
  })
  if (!connection) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'CalDAV connection was not found.',
      retryable: false,
    }
  }
  const ctx = await loadCalDavContext(connection)
  const result = await createCalDavCalendarProvider().listCalendars(ctx)
  if (!result.ok) {
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        syncStatus: CalendarConnectionStatus.NEEDS_ATTENTION,
        lastErrorCode: result.code,
        lastErrorMessage: result.safeMessage,
        lastAttemptedSyncAt: new Date(),
      },
    })
    return result
  }
  await persistDiscoveredCalendars({
    workspaceId,
    connectionId,
    calendars: result.value,
  })
  await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: {
      syncStatus: CalendarConnectionStatus.CONNECTED,
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
  return { ok: true as const, value: { calendars: result.value } }
}

export async function updateConnectedCalDavCalendar({
  workspaceId,
  calendarId,
  selectedForSync,
  syncDirection,
  defaultExportTarget,
  calendarPurpose,
}: {
  workspaceId: string
  calendarId: string
  selectedForSync?: boolean
  syncDirection?: string
  defaultExportTarget?: boolean
  calendarPurpose?: CalendarConnectionPurpose
}) {
  const calendar = await prisma.connectedCalendar.findFirst({
    where: {
      id: calendarId,
      workspaceId,
      connection: { provider: CALDAV_PROVIDER },
    },
  })
  if (!calendar) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'CalDAV calendar was not found.',
      retryable: false,
    }
  }
  if (defaultExportTarget) {
    await prisma.connectedCalendar.updateMany({
      where: { connectionId: calendar.connectionId, id: { not: calendar.id } },
      data: { defaultExportTarget: false },
    })
  }
  const nextSyncDirection = syncDirection
    ? toCalendarSyncDirection(syncDirection)
    : undefined
  const updated = await prisma.connectedCalendar.update({
    where: { id: calendar.id },
    data: {
      selectedForSync,
      syncDirection: nextSyncDirection,
      defaultExportTarget:
        typeof defaultExportTarget === 'boolean'
          ? defaultExportTarget && calendar.isWritable
          : undefined,
      calendarPurpose,
      importEnabled:
        nextSyncDirection === CalendarSyncDirection.EXPORT_ONLY ||
        nextSyncDirection === CalendarSyncDirection.DISABLED
          ? false
          : undefined,
      exportEnabled:
        nextSyncDirection === CalendarSyncDirection.IMPORT_ONLY ||
        nextSyncDirection === CalendarSyncDirection.AVAILABILITY_ONLY ||
        nextSyncDirection === CalendarSyncDirection.DISABLED
          ? false
          : nextSyncDirection
            ? true
            : undefined,
    },
  })
  return { ok: true as const, value: { calendar: updated } }
}

export async function disconnectCalDavConnection({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}) {
  await prisma.calendarConnection.updateMany({
    where: { id: connectionId, workspaceId, provider: CALDAV_PROVIDER },
    data: {
      syncStatus: CalendarConnectionStatus.DISCONNECTED,
      disconnectedAt: new Date(),
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenStatus: 'disconnected',
    },
  })
  return { ok: true as const, value: { disconnected: true } }
}

export async function syncCalDavConnection({
  workspaceId,
  connectionId,
  workerId = `caldav-manual-${Date.now()}`,
  dryRun = false,
}: {
  workspaceId: string
  connectionId: string
  workerId?: string
  dryRun?: boolean
}) {
  const startedAt = new Date()
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: CALDAV_PROVIDER },
    include: {
      workspaceMember: { select: { id: true } },
      calendars: {
        where: {
          selectedForSync: true,
          syncDirection: { not: CalendarSyncDirection.DISABLED },
        },
      },
    },
  })
  if (!connection) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'CalDAV connection was not found.',
      retryable: false,
    }
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const providerConfig = getSchedulingProviderConfig('caldav')
  const eligibility = resolveCalendarConnectionSyncEligibility({
    connection,
    workspacePolicy,
    ownerMember: connection.workspaceMember,
    providerHealth: providerConfig.status,
  })
  if (!eligibility.canPull && !eligibility.canPush) {
    await recordCalDavCalendarSyncLog({
      workspaceId,
      connectionId,
      direction: CalendarSyncDirectionLog.TWO_WAY,
      operation: 'syncConnection',
      status: CalendarSyncLogStatus.SUCCEEDED,
      safeMessage: `CalDAV sync skipped: ${eligibility.reasonCode}.`,
      workerId,
      startedAt,
      completedAt: new Date(),
      retryable: false,
    })
    return {
      ok: true as const,
      value: { processed: 0, failures: 0, dryRun, skipped: true },
    }
  }
  const ctx = await loadCalDavContext(connection)
  const provider = createCalDavCalendarProvider()
  let processed = 0
  let failures = 0
  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      syncStatus: CalendarConnectionStatus.INITIAL_SYNC,
      lastAttemptedSyncAt: startedAt,
    },
  })
  for (const calendar of connection.calendars) {
    if (
      eligibility.canPull &&
      (calendar.syncDirection === CalendarSyncDirection.IMPORT_ONLY ||
        calendar.syncDirection === CalendarSyncDirection.TWO_WAY ||
        calendar.syncDirection === CalendarSyncDirection.AVAILABILITY_ONLY)
    ) {
      const cursor = await prisma.calendarSyncCursor.findUnique({
        where: {
          connectionId_connectedCalendarId: {
            connectionId: connection.id,
            connectedCalendarId: calendar.id,
          },
        },
      })
      const pull = await provider.pullChanges({
        ...ctx,
        calendarId: calendar.providerCalendarId,
        syncToken: cursor?.cursor ?? calendar.lastSyncToken,
        pageToken: cursor?.pageToken,
      })
      if (!pull.ok) {
        failures += 1
        await prisma.connectedCalendar.update({
          where: { id: calendar.id },
          data: {
            lastErrorCode: pull.code,
            lastErrorMessage: pull.safeMessage,
          },
        })
        await recordCalDavCalendarSyncLog({
          workspaceId,
          connectionId,
          connectedCalendarId: calendar.id,
          direction: CalendarSyncDirectionLog.IMPORT,
          operation: 'pullChanges',
          status: CalendarSyncLogStatus.FAILED,
          safeMessage: pull.safeMessage,
          providerCode: pull.code,
          workerId,
          startedAt,
          retryable: pull.retryable,
        })
      } else if (!dryRun) {
        for (const pulledProviderEvent of pull.value.events) {
          const providerEvent = sanitizeExternalCalendarEvent({
            providerEvent: pulledProviderEvent,
            visibilityMode: connection.visibilityMode,
          })
          const personalCalendar =
            calendar.calendarPurpose === CalendarConnectionPurpose.PERSONAL
          if (personalCalendar && calendar.availabilityBehavior === 'IGNORE') {
            processed += 1
            continue
          }
          if (personalCalendar && providerEvent.id) {
            const syncHash = computeGoogleSyncHash({
              title: 'Unavailable',
              startsAtUtc: providerEvent.startsAtUtc,
              endsAtUtc: providerEvent.endsAtUtc,
              timezone: providerEvent.timezone,
              recurrence: providerEvent.recurrence,
            })
            await prisma.calendarEventMapping.upsert({
              where: {
                connectedCalendarId_providerEventId: {
                  connectedCalendarId: calendar.id,
                  providerEventId: providerEvent.id,
                },
              },
              create: {
                workspaceId,
                connectedCalendarId: calendar.id,
                providerEventId: providerEvent.id,
                providerSeriesId: providerEvent.recurringEventId,
                providerRecurringEventId: providerEvent.recurringEventId,
                providerEtag: providerEvent.providerEtag,
                providerVersion:
                  providerEvent.providerEtag ?? providerEvent.providerUpdatedAt,
                providerUpdatedAt: providerEvent.providerUpdatedAt
                  ? new Date(providerEvent.providerUpdatedAt)
                  : null,
                ownership: CalendarEventOwnership.EXTERNAL_ONLY,
                syncState: CalendarEventSyncState.SYNCED,
                syncHash,
                lastSyncOrigin: 'caldav',
                originOperation: 'caldav.pull.external_availability',
                lastSyncedAt: new Date(),
                lastPulledAt: new Date(),
                providerSnapshot: jsonInput({
                  kind: 'externalAvailability',
                  displayLabel: 'Unavailable',
                  startsAtUtc: providerEvent.startsAtUtc,
                  endsAtUtc: providerEvent.endsAtUtc,
                  provider: 'caldav',
                  effect:
                    calendar.availabilityBehavior === 'BLOCK_AVAILABILITY'
                      ? 'blocking'
                      : 'suggestion',
                  privacyLevel: 'BUSY_ONLY',
                }),
                metadata: jsonInput({
                  provider: 'caldav',
                  platform: metadataRecord(connection.metadata).platform,
                  connectionPurpose: calendar.calendarPurpose,
                  availabilityBehavior: calendar.availabilityBehavior,
                  busyDisplayMode: calendar.busyDisplayMode,
                  providerHref: providerEvent.id,
                  providerEtag: providerEvent.providerEtag,
                  calendarSyncToken: pull.value.nextSyncToken,
                }),
              },
              update: {
                providerEtag: providerEvent.providerEtag,
                providerVersion:
                  providerEvent.providerEtag ?? providerEvent.providerUpdatedAt,
                providerUpdatedAt: providerEvent.providerUpdatedAt
                  ? new Date(providerEvent.providerUpdatedAt)
                  : null,
                syncState: CalendarEventSyncState.SYNCED,
                syncHash,
                lastSyncOrigin: 'caldav',
                originOperation: 'caldav.pull.external_availability',
                lastSyncedAt: new Date(),
                lastPulledAt: new Date(),
                providerSnapshot: jsonInput({
                  kind: 'externalAvailability',
                  displayLabel: 'Unavailable',
                  startsAtUtc: providerEvent.startsAtUtc,
                  endsAtUtc: providerEvent.endsAtUtc,
                  provider: 'caldav',
                  effect:
                    calendar.availabilityBehavior === 'BLOCK_AVAILABILITY'
                      ? 'blocking'
                      : 'suggestion',
                  privacyLevel: 'BUSY_ONLY',
                }),
                metadata: jsonInput({
                  provider: 'caldav',
                  platform: metadataRecord(connection.metadata).platform,
                  connectionPurpose: calendar.calendarPurpose,
                  availabilityBehavior: calendar.availabilityBehavior,
                  busyDisplayMode: calendar.busyDisplayMode,
                  providerHref: providerEvent.id,
                  providerEtag: providerEvent.providerEtag,
                  calendarSyncToken: pull.value.nextSyncToken,
                }),
              },
            })
            processed += 1
            continue
          }

          const existing = providerEvent.id
            ? await prisma.calendarEventMapping.findUnique({
                where: {
                  connectedCalendarId_providerEventId: {
                    connectedCalendarId: calendar.id,
                    providerEventId: providerEvent.id,
                  },
                },
                include: { schedulingEvent: true },
              })
            : null
          if (
            existing &&
            shouldIgnoreGoogleProviderLoop({
              mapping: existing,
              providerEvent,
            })
          ) {
            await prisma.calendarEventMapping.update({
              where: { id: existing.id },
              data: {
                syncState: CalendarEventSyncState.SYNCED,
                lastPulledAt: new Date(),
                lastSyncOrigin: 'caldav',
                originOperation: 'caldav.pull.loop_ignored',
              },
            })
            processed += 1
            continue
          }
          const conflict = existing?.schedulingEvent
            ? detectCalendarSyncConflict({
                providerEvent,
                skillifyEventUpdatedAt:
                  existing.schedulingEvent.updatedAt.toISOString(),
                mappingProviderUpdatedAt:
                  existing.providerUpdatedAt?.toISOString() ?? null,
                conflictPolicy: connection.conflictPolicy,
              })
            : null
          if (conflict) {
            await prisma.calendarSyncConflict.create({
              data: {
                workspaceId,
                connectionId,
                connectedCalendarId: calendar.id,
                mappingId: existing?.id,
                schedulingEventId: existing?.schedulingEventId,
                provider: CALDAV_PROVIDER,
                conflictType: conflict.type,
                resolutionPolicy: connection.conflictPolicy,
                safeMessage: conflict.safeMessage
                  .replaceAll('Google Calendar', 'CalDAV')
                  .replaceAll('Google', 'CalDAV'),
                providerSnapshot: jsonInput(providerEvent.raw),
                skillifySnapshot: jsonInput(existing?.skillifySnapshot),
                metadata: jsonInput({
                  ...conflict.metadata,
                  provider: 'caldav',
                  platform: metadataRecord(connection.metadata).platform,
                  providerHref: providerEvent.id,
                  providerEtag: providerEvent.providerEtag,
                }),
              },
            })
          }
          let appliedSchedulingEventId = existing?.schedulingEventId ?? null
          if (!conflict && providerEvent.status !== 'cancelled') {
            if (existing?.schedulingEventId) {
              const updatedEvent = await schedulingRepository.updateEvent({
                workspaceId,
                eventId: existing.schedulingEventId,
                actorUserId: connection.connectedByUserId,
                input: providerEventToSchedulingInput(providerEvent),
              })
              appliedSchedulingEventId = updatedEvent.id
            } else {
              const createdEvent = await schedulingRepository.createEvent({
                workspaceId,
                actorUserId: connection.connectedByUserId,
                input: providerEventToSchedulingInput(providerEvent),
              })
              appliedSchedulingEventId = createdEvent.id
            }
          }
          if (providerEvent.id) {
            const syncHash = computeGoogleSyncHash({
              title: providerEvent.title,
              startsAtUtc: providerEvent.startsAtUtc,
              endsAtUtc: providerEvent.endsAtUtc,
              timezone: providerEvent.timezone,
              location: providerEvent.location,
              description: providerEvent.description,
              recurrence: providerEvent.recurrence,
            })
            await prisma.calendarEventMapping.upsert({
              where: {
                connectedCalendarId_providerEventId: {
                  connectedCalendarId: calendar.id,
                  providerEventId: providerEvent.id,
                },
              },
              create: {
                workspaceId,
                connectedCalendarId: calendar.id,
                schedulingEventId: appliedSchedulingEventId,
                recurrenceSeriesId: providerEvent.recurringEventId,
                occurrenceId: providerEvent.originalStartTime,
                providerEventId: providerEvent.id,
                providerSeriesId: providerEvent.recurringEventId,
                providerRecurringEventId: providerEvent.recurringEventId,
                providerOccurrenceId: providerEvent.originalStartTime,
                providerEtag: providerEvent.providerEtag,
                providerVersion:
                  providerEvent.providerEtag ?? providerEvent.providerUpdatedAt,
                providerUpdatedAt: providerEvent.providerUpdatedAt
                  ? new Date(providerEvent.providerUpdatedAt)
                  : undefined,
                ownership: CalendarEventOwnership.EXTERNAL_ONLY,
                syncState: conflict
                  ? CalendarEventSyncState.CONFLICT
                  : CalendarEventSyncState.SYNCED,
                lastSyncedAt: new Date(),
                lastPulledAt: new Date(),
                lastSyncOrigin: 'caldav',
                originOperation: 'caldav.pull',
                syncHash,
                providerSnapshot: jsonInput(providerEvent.raw),
                metadata: jsonInput({
                  provider: 'caldav',
                  platform: metadataRecord(connection.metadata).platform,
                  providerHref: providerEvent.id,
                  providerEtag: providerEvent.providerEtag,
                  calendarSyncToken: pull.value.nextSyncToken,
                }),
              },
              update: {
                recurrenceSeriesId: providerEvent.recurringEventId,
                occurrenceId: providerEvent.originalStartTime,
                providerSeriesId: providerEvent.recurringEventId,
                providerRecurringEventId: providerEvent.recurringEventId,
                providerOccurrenceId: providerEvent.originalStartTime,
                schedulingEventId: appliedSchedulingEventId,
                providerEtag: providerEvent.providerEtag,
                providerVersion:
                  providerEvent.providerEtag ?? providerEvent.providerUpdatedAt,
                providerUpdatedAt: providerEvent.providerUpdatedAt
                  ? new Date(providerEvent.providerUpdatedAt)
                  : undefined,
                syncState: conflict
                  ? CalendarEventSyncState.CONFLICT
                  : CalendarEventSyncState.SYNCED,
                lastSyncedAt: new Date(),
                lastPulledAt: new Date(),
                lastSyncOrigin: 'caldav',
                originOperation: 'caldav.pull',
                syncHash,
                providerSnapshot: jsonInput(providerEvent.raw),
                metadata: jsonInput({
                  provider: 'caldav',
                  platform: metadataRecord(connection.metadata).platform,
                  providerHref: providerEvent.id,
                  providerEtag: providerEvent.providerEtag,
                  calendarSyncToken: pull.value.nextSyncToken,
                }),
              },
            })
            processed += 1
          }
        }
        await prisma.calendarSyncCursor.upsert({
          where: {
            connectionId_connectedCalendarId: {
              connectionId: connection.id,
              connectedCalendarId: calendar.id,
            },
          },
          create: {
            workspaceId,
            connectionId: connection.id,
            connectedCalendarId: calendar.id,
            cursor: pull.value.nextSyncToken,
            pageToken: pull.value.nextPageToken,
          },
          update: {
            cursor: pull.value.nextSyncToken,
            pageToken: pull.value.nextPageToken,
          },
        })
        await prisma.connectedCalendar.update({
          where: { id: calendar.id },
          data: {
            lastSyncToken: pull.value.nextSyncToken,
            lastSyncedAt: new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        })
      }
    }

    if (
      eligibility.canPush &&
      (calendar.syncDirection === CalendarSyncDirection.EXPORT_ONLY ||
        calendar.syncDirection === CalendarSyncDirection.TWO_WAY)
    ) {
      const events = await schedulingRepository.listEventsByRange({
        workspaceId,
        startsBefore: new Date(Date.now() + 90 * 24 * 60 * 60_000),
        endsAfter: new Date(Date.now() - 24 * 60 * 60_000),
      })
      for (const event of events.filter(
        (entry) => entry.externalCalendarState !== 'synced',
      )) {
        if (dryRun) {
          processed += 1
          continue
        }
        const payload = mapSchedulingEventToGooglePayload(
          event,
          calendar.providerCalendarId,
        )
        const pushed = await provider.createEvent(ctx, payload)
        if (!pushed.ok) {
          failures += 1
          await recordCalDavCalendarSyncLog({
            workspaceId,
            connectionId,
            connectedCalendarId: calendar.id,
            direction: CalendarSyncDirectionLog.EXPORT,
            operation: 'pushChanges',
            status: CalendarSyncLogStatus.FAILED,
            safeMessage: pushed.safeMessage,
            providerCode: pushed.code,
            workerId,
            startedAt,
            retryable: pushed.retryable,
          })
          continue
        }
        await prisma.calendarEventMapping.upsert({
          where: {
            connectedCalendarId_providerEventId: {
              connectedCalendarId: calendar.id,
              providerEventId: pushed.value.id as string,
            },
          },
          create: {
            workspaceId,
            connectedCalendarId: calendar.id,
            schedulingEventId: event.id,
            recurrenceSeriesId: event.recurrenceSeriesId,
            occurrenceId: event.occurrenceOriginalAt,
            providerEventId: pushed.value.id as string,
            providerSeriesId: pushed.value.recurringEventId,
            providerRecurringEventId: pushed.value.recurringEventId,
            providerOccurrenceId: pushed.value.originalStartTime,
            providerEtag: pushed.value.providerEtag,
            providerVersion:
              pushed.value.providerEtag ?? pushed.value.providerUpdatedAt,
            providerUpdatedAt: pushed.value.providerUpdatedAt
              ? new Date(pushed.value.providerUpdatedAt)
              : undefined,
            ownership: CalendarEventOwnership.SKILLIFY_NATIVE,
            syncState: CalendarEventSyncState.SYNCED,
            lastSyncedAt: new Date(),
            lastPushedAt: new Date(),
            lastSyncOrigin: 'skillify',
            originOperation: 'skillify.export.caldav',
            syncHash: computeGoogleSyncHash(payload),
            providerSnapshot: jsonInput(pushed.value.raw),
            skillifySnapshot: jsonInput(payload.raw),
            metadata: jsonInput({
              provider: 'caldav',
              platform: metadataRecord(connection.metadata).platform,
              providerHref: pushed.value.id,
              providerEtag: pushed.value.providerEtag,
            }),
          },
          update: {
            schedulingEventId: event.id,
            recurrenceSeriesId: event.recurrenceSeriesId,
            occurrenceId: event.occurrenceOriginalAt,
            providerSeriesId: pushed.value.recurringEventId,
            providerRecurringEventId: pushed.value.recurringEventId,
            providerOccurrenceId: pushed.value.originalStartTime,
            syncState: CalendarEventSyncState.SYNCED,
            providerEtag: pushed.value.providerEtag,
            providerVersion:
              pushed.value.providerEtag ?? pushed.value.providerUpdatedAt,
            providerUpdatedAt: pushed.value.providerUpdatedAt
              ? new Date(pushed.value.providerUpdatedAt)
              : undefined,
            lastSyncedAt: new Date(),
            lastPushedAt: new Date(),
            lastSyncOrigin: 'skillify',
            originOperation: 'skillify.export.caldav',
            syncHash: computeGoogleSyncHash(payload),
            providerSnapshot: jsonInput(pushed.value.raw),
            skillifySnapshot: jsonInput(payload.raw),
            metadata: jsonInput({
              provider: 'caldav',
              platform: metadataRecord(connection.metadata).platform,
              providerHref: pushed.value.id,
              providerEtag: pushed.value.providerEtag,
            }),
          },
        })
        processed += 1
      }
    }
  }
  const completedAt = new Date()
  await recordCalDavCalendarSyncLog({
    workspaceId,
    connectionId,
    direction: CalendarSyncDirectionLog.TWO_WAY,
    operation: dryRun ? 'dryRunSync' : 'syncConnection',
    status:
      failures > 0
        ? CalendarSyncLogStatus.RETRYING
        : CalendarSyncLogStatus.SUCCEEDED,
    safeMessage:
      failures > 0
        ? `${failures} CalDAV sync operations need attention.`
        : `Processed ${processed} CalDAV sync records.`,
    workerId,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  })
  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      syncStatus:
        failures > 0
          ? CalendarConnectionStatus.NEEDS_ATTENTION
          : CalendarConnectionStatus.CONNECTED,
      lastAttemptedSyncAt: startedAt,
      lastSuccessfulSyncAt: failures > 0 ? undefined : completedAt,
      nextSyncAt: new Date(
        completedAt.getTime() + connection.syncFrequencyMinutes * 60_000,
      ),
      lastErrorCode: failures > 0 ? 'caldavSyncFailures' : null,
      lastErrorMessage:
        failures > 0
          ? `${failures} CalDAV sync operations need attention.`
          : null,
    },
  })
  return { ok: true as const, value: { processed, failures, dryRun } }
}

export async function createCalDavCalendarImportPreview({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}) {
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: CALDAV_PROVIDER },
    include: {
      workspaceMember: { select: { id: true } },
      calendars: {
        where: {
          selectedForSync: true,
          syncDirection: {
            in: [
              CalendarSyncDirection.IMPORT_ONLY,
              CalendarSyncDirection.TWO_WAY,
              CalendarSyncDirection.AVAILABILITY_ONLY,
            ],
          },
        },
      },
    },
  })
  if (!connection) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'CalDAV connection was not found.',
      retryable: false,
    }
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const providerConfig = getSchedulingProviderConfig('caldav')
  const eligibility = resolveCalendarConnectionSyncEligibility({
    connection,
    workspacePolicy,
    ownerMember: connection.workspaceMember,
    providerHealth: providerConfig.status,
  })
  if (!eligibility.canPull) {
    return {
      ok: false as const,
      code: eligibility.reasonCode,
      safeMessage: 'This CalDAV connection is not eligible for import preview.',
      retryable: false,
    }
  }
  const ctx = await loadCalDavContext(connection)
  const provider = createCalDavCalendarProvider()
  const [skillifyEvents, mappings] = await Promise.all([
    schedulingRepository.listEventsByRange({
      workspaceId,
      startsBefore: new Date(Date.now() + 365 * 24 * 60 * 60_000),
      endsAfter: new Date(Date.now() - 365 * 24 * 60 * 60_000),
    }),
    prisma.calendarEventMapping.findMany({
      where: { workspaceId },
      select: {
        providerEventId: true,
        schedulingEventId: true,
      },
    }),
  ])
  const calDavEvents: ProviderEventPayload[] = []
  const skipped: Array<{ providerEventId?: string; reason: string }> = []
  for (const calendar of connection.calendars) {
    const pulled = await provider.pullChanges({
      ...ctx,
      calendarId: calendar.providerCalendarId,
    })
    if (!pulled.ok) {
      skipped.push({
        providerEventId: calendar.providerCalendarId,
        reason: pulled.safeMessage,
      })
      continue
    }
    calDavEvents.push(
      ...pulled.value.events.map((providerEvent) =>
        sanitizeExternalCalendarEvent({
          providerEvent,
          visibilityMode: connection.visibilityMode,
        }),
      ),
    )
  }
  const preview = createGoogleImportPreview({
    skillifyEvents,
    googleEvents: calDavEvents,
    mappings,
  })
  return {
    ok: true as const,
    value: {
      ...preview,
      existingCalDavEvents: calDavEvents.length,
      eventsSkipped: [...preview.eventsSkipped, ...skipped],
      dryRun: true,
    },
  }
}

export async function resolveCalDavCalendarConflict({
  workspaceId,
  conflictId,
  actorUserId,
  resolution,
  rememberDecision = false,
}: {
  workspaceId: string
  conflictId: string
  actorUserId: string
  resolution:
    | 'keepSkillify'
    | 'keepCalDav'
    | 'keepGoogle'
    | 'merge'
    | 'ignore'
    | 'retryLater'
  rememberDecision?: boolean
}) {
  const conflict = await prisma.calendarSyncConflict.findFirst({
    where: { id: conflictId, workspaceId, provider: CALDAV_PROVIDER },
    include: { mapping: true },
  })
  if (!conflict) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'CalDAV conflict was not found.',
      retryable: false,
    }
  }
  if (resolution === 'retryLater') {
    await prisma.calendarSyncConflict.update({
      where: { id: conflict.id },
      data: {
        resolution,
        metadata: jsonInput({
          ...metadataRecord(conflict.metadata),
          retryRequestedAt: new Date().toISOString(),
        }),
      },
    })
    return { ok: true as const, value: { conflictId, resolution } }
  }

  const providerResolution =
    resolution === 'keepGoogle' ? 'keepCalDav' : resolution
  const mappingState =
    providerResolution === 'keepSkillify'
      ? CalendarEventSyncState.PENDING_PUSH
      : providerResolution === 'ignore'
        ? CalendarEventSyncState.SYNCED
        : CalendarEventSyncState.PENDING_PULL
  await prisma.$transaction(async (tx) => {
    await tx.calendarSyncConflict.update({
      where: { id: conflict.id },
      data: {
        status: CalendarSyncConflictStatus.RESOLVED,
        resolution: providerResolution,
        resolvedAt: new Date(),
        resolvedByUserId: actorUserId,
        metadata: jsonInput({
          ...metadataRecord(conflict.metadata),
          rememberDecision,
        }),
      },
    })
    if (conflict.mappingId) {
      await tx.calendarEventMapping.update({
        where: { id: conflict.mappingId },
        data: {
          syncState: mappingState,
          conflictResolvedAt: new Date(),
          conflictType: conflict.conflictType,
          conflictMetadata: jsonInput(conflict.metadata),
          lastSyncOrigin:
            providerResolution === 'keepSkillify' ? 'skillify' : 'caldav',
          originOperation: `conflict.${providerResolution}`,
        },
      })
    }
  })
  return {
    ok: true as const,
    value: { conflictId, resolution: providerResolution },
  }
}

export async function inspectCalDavCalendarMappingIntegrity({
  workspaceId,
  repair = false,
}: {
  workspaceId: string
  repair?: boolean
}) {
  const [mappings, events] = await Promise.all([
    prisma.calendarEventMapping.findMany({
      where: {
        workspaceId,
        connectedCalendar: {
          connection: { provider: CALDAV_PROVIDER },
        },
      },
    }),
    prisma.schedulingEvent.findMany({
      where: { workspaceId },
      select: { id: true },
    }),
  ])
  const findings = inspectGoogleMappingIntegrity({
    mappings,
    knownSkillifyEventIds: new Set(events.map((event) => event.id)),
  }).map((finding) => ({
    ...finding,
    message: finding.message
      .replaceAll('Google Calendar', 'CalDAV')
      .replaceAll('Google', 'CalDAV'),
  }))
  let repaired = 0
  if (repair) {
    const missingSkillifyMappingIds = findings
      .filter(
        (finding) =>
          finding.code === 'missingSkillifyEvent' && finding.mappingId,
      )
      .map((finding) => finding.mappingId as string)
    if (missingSkillifyMappingIds.length) {
      const result = await prisma.calendarEventMapping.updateMany({
        where: { id: { in: missingSkillifyMappingIds }, workspaceId },
        data: {
          syncState: CalendarEventSyncState.SKILLIFY_DELETED,
          deletedAtSkillify: true,
          originOperation: 'repair.caldav.missing_skillify_event',
        },
      })
      repaired += result.count
    }
  }
  await prisma.calendarSyncDiagnostic.create({
    data: {
      workspaceId,
      workerKind: 'caldav.mappingIntegrity',
      status: findings.some((finding) => finding.severity === 'error')
        ? 'error'
        : findings.some((finding) => finding.severity === 'warning')
          ? 'warning'
          : 'ok',
      failedMappings: findings.filter((finding) => finding.severity === 'error')
        .length,
      openConflicts: findings.filter(
        (finding) => finding.code === 'multipleProviderEvents',
      ).length,
      safeMessage:
        findings.length > 0
          ? `${findings.length} CalDAV mapping integrity findings.`
          : 'CalDAV mappings passed integrity checks.',
      metadata: jsonInput({ findings, repaired }),
    },
  })
  return { ok: true as const, value: { findings, repaired } }
}

export async function recordCalDavCalendarSyncLog({
  workspaceId,
  connectionId,
  connectedCalendarId,
  direction,
  operation,
  status,
  safeMessage,
  providerCode,
  workerId,
  startedAt,
  completedAt,
  durationMs,
  retryable,
  metadata,
}: {
  workspaceId: string
  connectionId?: string
  connectedCalendarId?: string
  direction: CalendarSyncDirectionLog
  operation: string
  status: CalendarSyncLogStatus
  safeMessage?: string
  providerCode?: string
  workerId?: string
  startedAt: Date
  completedAt?: Date
  durationMs?: number
  retryable?: boolean
  metadata?: object
}) {
  return prisma.calendarSyncLog.create({
    data: {
      workspaceId,
      connectionId,
      connectedCalendarId,
      direction,
      operation,
      status,
      safeMessage,
      providerCode,
      workerId,
      startedAt,
      completedAt,
      durationMs,
      retryable,
      metadata: jsonInput(metadata),
    },
  })
}
