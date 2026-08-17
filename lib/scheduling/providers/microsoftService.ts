import { randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import {
  CalendarConnectionStatus,
  CalendarConnectionOwnershipType,
  CalendarConnectionApprovalStatus,
  CalendarConnectionPurpose,
  CalendarPurposeClassificationSource,
  CalendarEventOwnership,
  CalendarEventSyncState,
  CalendarProvider as PrismaCalendarProvider,
  CalendarSyncDirection,
  CalendarSyncDirectionLog,
  CalendarSyncConflictStatus,
  CalendarSyncLogStatus,
  CalendarWatchChannelStatus,
  type Prisma,
  type CalendarConnection,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import { decryptToken, encryptToken } from '@/lib/integrations/crypto'
import { schedulingRepository } from '@/lib/scheduling/repository'
import { getSchedulingProviderConfig } from '@/lib/scheduling/providers/config'
import {
  createMicrosoftCalendarProvider,
  createMicrosoftWatchChannelId,
} from '@/lib/scheduling/providers/microsoft'
import { mapSchedulingEventToGooglePayload } from '@/lib/scheduling/providers/recurrenceMapping'
import { detectCalendarSyncConflict } from '@/lib/scheduling/providers/syncEngine'
import {
  classifyGoogleWebhookDelivery,
  computeGoogleSyncHash,
  createGoogleImportPreview,
  inspectGoogleMappingIntegrity,
  shouldIgnoreGoogleProviderLoop,
} from '@/lib/scheduling/providers/googleSyncHardening'
import type {
  ProviderCalendar,
  ProviderEventPayload,
} from '@/lib/scheduling/providers/types'
import {
  coerceCalendarSyncDirectionForPolicy,
  classifyCalendarConnectionPurpose,
  getMemberConnectionInitialGovernance,
  getWorkspaceCalendarConnectionPolicy,
  getWorkspaceConnectionInitialGovernance,
  resolvePersonalCalendarAccess,
  resolveCalendarConnectionSyncEligibility,
  resolveCalendarClassificationConfirmation,
  sanitizeExternalCalendarEvent,
  toPersonalCalendarAvailabilityBehaviorPrisma,
  toPersonalCalendarBusyDisplayModePrisma,
  writeCalendarGovernanceOutboxEvent,
} from '@/lib/scheduling/providers/calendarGovernance'

const MICROSOFT_PROVIDER = PrismaCalendarProvider.OUTLOOK

function generateState() {
  return randomBytes(24).toString('hex')
}

function encryptNullable(value?: string | null) {
  return value ? encryptToken(value) : null
}

function decryptNullable(value?: string | null) {
  return value ? decryptToken(value) : undefined
}

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined
  return value as Prisma.InputJsonValue
}

function safeCompare(first: string, second: string) {
  const firstBuffer = Buffer.from(first)
  const secondBuffer = Buffer.from(second)
  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  )
}

function toCalendarSyncDirection(value: string | undefined) {
  if (value === 'EXPORT_ONLY') return CalendarSyncDirection.EXPORT_ONLY
  if (value === 'TWO_WAY') return CalendarSyncDirection.TWO_WAY
  if (value === 'AVAILABILITY_ONLY')
    return CalendarSyncDirection.AVAILABILITY_ONLY
  if (value === 'DISABLED') return CalendarSyncDirection.DISABLED
  return CalendarSyncDirection.IMPORT_ONLY
}

function isWritableCalendar(calendar: ProviderCalendar) {
  return (
    calendar.isWritable === true ||
    ['owner', 'writer'].includes(calendar.accessRole ?? '')
  )
}

function providerEventToSchedulingInput(providerEvent: ProviderEventPayload) {
  return {
    title: providerEvent.title || 'Untitled Microsoft Outlook event',
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

export async function listMicrosoftCalendarIntegrationState({
  workspaceId,
  actorWorkspaceMemberId,
  canManageScheduling = false,
}: {
  workspaceId: string
  actorWorkspaceMemberId?: string
  canManageScheduling?: boolean
}) {
  const providerConfig = getSchedulingProviderConfig('microsoft')
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const [connections, actorMembership] = await Promise.all([
    prisma.calendarConnection.findMany({
      where: { workspaceId, provider: MICROSOFT_PROVIDER },
      include: {
        calendars: {
          orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        },
        watchChannels: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        syncLogs: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
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
      key: 'microsoft',
      label: providerConfig.label,
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
        classificationConfirmation:
          connection.metadata &&
          typeof connection.metadata === 'object' &&
          !Array.isArray(connection.metadata)
            ? (connection.metadata as Record<string, unknown>)
                .classificationConfirmation
            : null,
        availabilityBehavior: connection.availabilityBehavior,
        busyDisplayMode: connection.busyDisplayMode,
        visibilityMode: connection.visibilityMode,
        approvalStatus: connection.approvalStatus,
        disabledAt: connection.disabledAt?.toISOString() ?? null,
        disabledReason: connection.disabledReason,
        ownerInactiveAt: connection.ownerInactiveAt?.toISOString() ?? null,
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
          connection.workspaceMemberId === actorWorkspaceMemberId,
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
          nextSyncAt: calendar.nextSyncAt?.toISOString() ?? null,
          lastErrorCode: calendar.lastErrorCode,
          lastErrorMessage: calendar.lastErrorMessage,
        })),
        watchChannels: connection.watchChannels.map((channel) => ({
          id: channel.id,
          connectedCalendarId: channel.connectedCalendarId,
          providerCalendarId: channel.providerCalendarId,
          status: channel.status,
          expiresAt: channel.expiresAt?.toISOString() ?? null,
          lastNotificationAt: channel.lastNotificationAt?.toISOString() ?? null,
        })),
        openConflicts: connection.conflicts.length,
        conflicts: connection.conflicts.map((conflict) => ({
          id: conflict.id,
          type: conflict.conflictType,
          safeMessage: conflict.safeMessage,
          detectedAt: conflict.detectedAt.toISOString(),
          providerSnapshot: conflict.providerSnapshot,
          skillifySnapshot: conflict.skillifySnapshot,
          metadata: conflict.metadata,
        })),
        recentLogs: connection.syncLogs.map((log) => ({
          id: log.id,
          operation: log.operation,
          direction: log.direction,
          status: log.status,
          safeMessage: log.safeMessage,
          startedAt: log.startedAt.toISOString(),
          completedAt: log.completedAt?.toISOString() ?? null,
        })),
      }
    }),
    diagnostics: {
      pendingSync,
      connectedAccounts: connections.filter(
        (connection) =>
          connection.syncStatus === CalendarConnectionStatus.CONNECTED,
      ).length,
      openConflicts: connections.reduce(
        (total, connection) => total + connection.conflicts.length,
        0,
      ),
      activeWatchChannels: connections.reduce(
        (total, connection) =>
          total +
          connection.watchChannels.filter(
            (channel) => channel.status === CalendarWatchChannelStatus.ACTIVE,
          ).length,
        0,
      ),
      expiredWatchChannels: connections.reduce(
        (total, connection) =>
          total +
          connection.watchChannels.filter(
            (channel) => channel.status === CalendarWatchChannelStatus.EXPIRED,
          ).length,
        0,
      ),
    },
  }
}

export async function beginMicrosoftCalendarOAuth({
  workspaceId,
  actorUserId,
  actorWorkspaceMemberId,
  ownershipType = CalendarConnectionOwnershipType.MEMBER,
  requestedPurpose,
  returnToSetup,
  setupStep,
}: {
  workspaceId: string
  actorUserId: string
  actorWorkspaceMemberId: string
  ownershipType?: CalendarConnectionOwnershipType
  requestedPurpose?: CalendarConnectionPurpose
  returnToSetup?: boolean
  setupStep?: string
}) {
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  if (
    ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    !workspacePolicy.allowMemberConnections
  ) {
    return {
      ok: false as const,
      code: 'memberConnectionsDisabled',
      safeMessage:
        'This workspace does not allow members to connect personal calendars.',
      retryable: false,
    }
  }
  if (
    ownershipType === CalendarConnectionOwnershipType.WORKSPACE &&
    !workspacePolicy.allowWorkspaceConnections
  ) {
    return {
      ok: false as const,
      code: 'workspaceConnectionsDisabled',
      safeMessage:
        'This workspace does not allow workspace-owned calendar accounts.',
      retryable: false,
    }
  }
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      id: actorWorkspaceMemberId,
      workspaceId,
      userId: actorUserId,
    },
    select: { id: true, role: true },
  })
  if (!membership) {
    return {
      ok: false as const,
      code: 'workspaceMemberNotFound',
      safeMessage:
        'Workspace membership could not be verified for calendar connection.',
      retryable: false,
    }
  }
  const connectionPurpose =
    requestedPurpose ??
    (ownershipType === CalendarConnectionOwnershipType.WORKSPACE
      ? CalendarConnectionPurpose.WORKSPACE_SHARED
      : CalendarConnectionPurpose.PERSONAL)
  if (
    ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    (connectionPurpose === CalendarConnectionPurpose.WORKSPACE_SHARED ||
      connectionPurpose === CalendarConnectionPurpose.RESOURCE)
  ) {
    return {
      ok: false as const,
      code: 'purposeNotAllowed',
      safeMessage:
        'Only workspace admins can classify connected accounts as shared workspace or resource calendars.',
      retryable: false,
    }
  }
  if (
    ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    connectionPurpose === CalendarConnectionPurpose.PERSONAL
  ) {
    const access = resolvePersonalCalendarAccess({
      workspacePolicy,
      workspaceMember: membership,
    })
    if (!access.canRequestConnection) {
      return {
        ok: false as const,
        code: access.reasonCode ?? 'personalCalendarPolicyDenied',
        safeMessage:
          'This workspace does not allow you to connect a personal calendar.',
        retryable: false,
      }
    }
  }
  if (
    ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    !workspacePolicy.allowMultipleAccountsPerMember
  ) {
    const existingMemberConnection = await prisma.calendarConnection.findFirst({
      where: {
        workspaceId,
        provider: MICROSOFT_PROVIDER,
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
          'This workspace allows only one personal Microsoft Outlook account per member.',
        retryable: false,
      }
    }
  }
  const initialGovernance =
    ownershipType === CalendarConnectionOwnershipType.MEMBER
      ? getMemberConnectionInitialGovernance(workspacePolicy, connectionPurpose)
      : getWorkspaceConnectionInitialGovernance(workspacePolicy)
  const provider = createMicrosoftCalendarProvider()
  const state = generateState()
  const stateExpiresAt = new Date(Date.now() + 10 * 60_000)
  const connection = await prisma.calendarConnection.create({
    data: {
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
      provider: MICROSOFT_PROVIDER,
      providerAccountId: `pending:${state}`,
      syncStatus: CalendarConnectionStatus.CONNECTING,
      oauthState: state,
      oauthStateExpiresAt: stateExpiresAt,
      metadata: {
        oauthStartedAt: new Date().toISOString(),
        ownershipType,
        connectionPurpose,
        classificationSource:
          CalendarPurposeClassificationSource.MEMBER_SELECTED,
        workspaceMemberId:
          ownershipType === CalendarConnectionOwnershipType.MEMBER
            ? actorWorkspaceMemberId
            : null,
        connectedByWorkspaceMemberId: actorWorkspaceMemberId,
        approvalStatus: initialGovernance.approvalStatus,
        visibilityMode: initialGovernance.visibilityMode,
        returnToSetup: returnToSetup === true,
        setupStep,
      },
    },
    select: { id: true },
  })
  const result = provider.connect({
    workspaceId,
    workspaceMemberId: actorWorkspaceMemberId,
    state,
    returnToSetup,
    setupStep,
  })
  if (!result.ok) {
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        syncStatus: CalendarConnectionStatus.NEEDS_ATTENTION,
        lastErrorCode: result.code,
        lastErrorMessage: result.safeMessage,
      },
    })
    return result
  }
  return {
    ok: true as const,
    value: {
      ...result.value,
      connectionId: connection.id,
      stateExpiresAt: stateExpiresAt.toISOString(),
    },
  }
}

async function loadConnectionTokens(connection: CalendarConnection) {
  return {
    accessToken: decryptNullable(connection.accessTokenEncrypted),
    refreshToken: decryptNullable(connection.refreshTokenEncrypted),
  }
}

export async function refreshMicrosoftCalendarConnection({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}) {
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: MICROSOFT_PROVIDER },
    include: {
      workspaceMember: { select: { id: true } },
    },
  })
  if (!connection) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'Microsoft Outlook connection was not found.',
      retryable: false,
    }
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const providerConfig = getSchedulingProviderConfig('microsoft')
  const eligibility = resolveCalendarConnectionSyncEligibility({
    connection,
    workspacePolicy,
    ownerMember: connection.workspaceMember,
    providerHealth: providerConfig.status,
  })
  if (!eligibility.canDiscoverCalendars) {
    return {
      ok: false as const,
      code: eligibility.reasonCode,
      safeMessage:
        'This Microsoft Outlook connection is not eligible for token refresh.',
      retryable: false,
    }
  }
  const tokens = await loadConnectionTokens(connection)
  const result = await createMicrosoftCalendarProvider().refreshToken({
    workspaceId,
    connectionId,
    ...tokens,
  })
  if (!result.ok) {
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        syncStatus: CalendarConnectionStatus.NEEDS_ATTENTION,
        tokenStatus:
          result.code === 'invalid_grant' ? 'revoked' : 'refreshFailed',
        lastErrorCode: result.code,
        lastErrorMessage: result.safeMessage,
        lastAttemptedSyncAt: new Date(),
      },
    })
    return result
  }
  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptToken(result.value.accessToken),
      refreshTokenEncrypted:
        encryptNullable(result.value.refreshToken) ??
        connection.refreshTokenEncrypted,
      tokenExpiresAt: result.value.expiresAt,
      scopes: jsonInput(result.value.scopes) ?? jsonInput(connection.scopes),
      tokenStatus: 'valid',
      lastValidatedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
  return result
}

export async function completeMicrosoftCalendarOAuth({
  workspaceId,
  workspaceMemberId,
  state,
  code,
}: {
  workspaceId: string
  workspaceMemberId?: string | null
  state: string
  code: string
}) {
  const pending = await prisma.calendarConnection.findFirst({
    where: {
      workspaceId,
      provider: MICROSOFT_PROVIDER,
      syncStatus: CalendarConnectionStatus.CONNECTING,
      oauthState: { not: null },
      ...(workspaceMemberId
        ? { connectedByWorkspaceMemberId: workspaceMemberId }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!pending?.oauthState || !safeCompare(pending.oauthState, state)) {
    return {
      ok: false as const,
      code: 'invalidState',
      safeMessage: 'Microsoft Outlook OAuth state could not be verified.',
      retryable: false,
    }
  }
  if (pending.oauthStateExpiresAt && pending.oauthStateExpiresAt < new Date()) {
    return {
      ok: false as const,
      code: 'stateExpired',
      safeMessage:
        'Microsoft Outlook OAuth state expired. Reconnect and try again.',
      retryable: false,
    }
  }
  const membershipId =
    pending.connectedByWorkspaceMemberId ?? pending.workspaceMemberId
  if (!membershipId) {
    return {
      ok: false as const,
      code: 'missingWorkspaceMember',
      safeMessage:
        'Microsoft Outlook OAuth state is missing workspace member ownership.',
      retryable: false,
    }
  }
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      id: membershipId,
      workspaceId,
    },
    select: { id: true, role: true },
  })
  if (!membership) {
    return {
      ok: false as const,
      code: 'workspaceMemberInactive',
      safeMessage:
        'The member who started this Microsoft Outlook connection no longer belongs to the workspace.',
      retryable: false,
    }
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  if (
    pending.ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    !workspacePolicy.allowMemberConnections
  ) {
    await prisma.calendarConnection.update({
      where: { id: pending.id },
      data: {
        syncStatus: CalendarConnectionStatus.DISCONNECTED,
        disabledAt: new Date(),
        disabledReason: 'MEMBER_CONNECTIONS_DISABLED',
        oauthState: null,
        oauthStateExpiresAt: null,
      },
    })
    return {
      ok: false as const,
      code: 'memberConnectionsDisabled',
      safeMessage:
        'This workspace no longer allows members to connect personal calendars.',
      retryable: false,
    }
  }
  if (
    pending.ownershipType === CalendarConnectionOwnershipType.MEMBER &&
    pending.connectionPurpose === CalendarConnectionPurpose.PERSONAL
  ) {
    const access = resolvePersonalCalendarAccess({
      workspacePolicy,
      workspaceMember: membership,
    })
    if (!access.canRequestConnection) {
      await prisma.calendarConnection.update({
        where: { id: pending.id },
        data: {
          syncStatus: CalendarConnectionStatus.DISCONNECTED,
          disabledAt: new Date(),
          disabledReason: 'PERSONAL_CALENDAR_POLICY_DENIED',
          oauthState: null,
          oauthStateExpiresAt: null,
        },
      })
      return {
        ok: false as const,
        code: access.reasonCode ?? 'personalCalendarPolicyDenied',
        safeMessage:
          'This workspace no longer allows you to connect a personal calendar.',
        retryable: false,
      }
    }
  }
  const finalGovernance =
    pending.ownershipType === CalendarConnectionOwnershipType.MEMBER
      ? getMemberConnectionInitialGovernance(
          workspacePolicy,
          pending.connectionPurpose,
        )
      : getWorkspaceConnectionInitialGovernance(workspacePolicy)
  const provider = createMicrosoftCalendarProvider()
  const tokenResult = await provider.exchangeCode({ code })
  if (!tokenResult.ok) {
    await prisma.calendarConnection.update({
      where: { id: pending.id },
      data: {
        syncStatus: CalendarConnectionStatus.NEEDS_ATTENTION,
        lastErrorCode: tokenResult.code,
        lastErrorMessage: tokenResult.safeMessage,
      },
    })
    return tokenResult
  }
  const calendarProbe = await provider.listCalendars({
    workspaceId,
    connectionId: pending.id,
    accessToken: tokenResult.value.accessToken,
    refreshToken: tokenResult.value.refreshToken,
  })
  const accountCalendar = calendarProbe.ok
    ? (calendarProbe.value.find((calendar) => calendar.isPrimary) ??
      calendarProbe.value[0])
    : null
  const providerAccountId =
    tokenResult.value.providerAccountId ??
    accountCalendar?.ownerEmail ??
    tokenResult.value.accountEmail ??
    `microsoft:${pending.id}`
  const existing = await prisma.calendarConnection.findFirst({
    where: {
      workspaceId,
      provider: MICROSOFT_PROVIDER,
      providerAccountId,
      id: { not: pending.id },
      disconnectedAt: null,
    },
    select: { id: true },
  })
  if (existing) {
    await prisma.calendarConnection.update({
      where: { id: pending.id },
      data: {
        syncStatus: CalendarConnectionStatus.DISCONNECTED,
        disconnectedAt: new Date(),
        lastErrorCode: 'duplicateProviderAccount',
        lastErrorMessage:
          'This account is already connected to this workspace.',
        oauthState: null,
        oauthStateExpiresAt: null,
      },
    })
    return {
      ok: false as const,
      code: 'duplicateProviderAccount',
      safeMessage: 'This account is already connected to this workspace.',
      retryable: false,
    }
  }
  const suggestedClassification = classifyCalendarConnectionPurpose({
    provider: 'microsoft',
    providerEmail:
      tokenResult.value.accountEmail ?? accountCalendar?.ownerEmail,
    providerAccountType: (
      accountCalendar?.raw as { accountType?: string } | undefined
    )?.accountType,
    tenantMetadata: accountCalendar?.raw,
    providerCalendarMetadata: accountCalendar?.raw,
    workspaceBusinessDomains: workspacePolicy.workspaceBusinessDomains,
    ownershipType: pending.ownershipType,
  })
  const confirmation = resolveCalendarClassificationConfirmation({
    requestedPurpose: pending.connectionPurpose,
    suggestedPurpose: suggestedClassification.purpose,
    classificationConfidence: suggestedClassification.confidence,
    suggestedReasonCode: suggestedClassification.reasonCode,
    workspacePolicy,
    actor: membership,
    ownershipType: pending.ownershipType,
  })
  const confirmationMetadata = {
    status: confirmation.status,
    requestedPurpose: pending.connectionPurpose,
    suggestedPurpose: suggestedClassification.purpose,
    suggestedSource: suggestedClassification.source,
    classificationConfidence: suggestedClassification.confidence,
    reasonCode: confirmation.reasonCode,
    mismatchReason: confirmation.mismatchReason,
    requiredAt: confirmation.required ? new Date().toISOString() : undefined,
  }
  const connection = await prisma.calendarConnection.update({
    where: { id: pending.id },
    data: {
      providerAccountId,
      accountEmail:
        tokenResult.value.accountEmail ?? accountCalendar?.ownerEmail,
      displayName: tokenResult.value.displayName ?? accountCalendar?.name,
      accessTokenEncrypted: encryptToken(tokenResult.value.accessToken),
      refreshTokenEncrypted: encryptNullable(tokenResult.value.refreshToken),
      tokenExpiresAt: tokenResult.value.expiresAt,
      scopes: tokenResult.value.scopes ?? [],
      connectionPurpose:
        pending.classificationSource ===
        CalendarPurposeClassificationSource.MEMBER_SELECTED
          ? pending.connectionPurpose
          : suggestedClassification.purpose,
      classificationSource:
        pending.classificationSource ===
        CalendarPurposeClassificationSource.MEMBER_SELECTED
          ? pending.classificationSource
          : suggestedClassification.source,
      classificationConfidence:
        pending.classificationConfidence ?? suggestedClassification.confidence,
      classifiedAt: pending.classifiedAt ?? new Date(),
      syncStatus: confirmation.required
        ? CalendarConnectionStatus.NEEDS_ATTENTION
        : CalendarConnectionStatus.CONNECTED,
      approvalStatus: confirmation.required
        ? CalendarConnectionApprovalStatus.NEEDS_REVIEW
        : finalGovernance.approvalStatus,
      visibilityMode: finalGovernance.visibilityMode,
      availabilityBehavior: finalGovernance.availabilityBehavior,
      busyDisplayMode: finalGovernance.busyDisplayMode,
      tokenStatus: 'valid',
      lastValidatedAt: new Date(),
      oauthState: null,
      oauthStateExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: {
        ...(pending.metadata && typeof pending.metadata === 'object'
          ? (pending.metadata as Record<string, unknown>)
          : {}),
        providerPurposeSuggestion: {
          purpose: suggestedClassification.purpose,
          source: suggestedClassification.source,
          confidence: suggestedClassification.confidence,
          reasonCode: suggestedClassification.reasonCode,
        },
        classificationConfirmation: confirmationMetadata,
      },
    },
  })
  if (confirmation.required) {
    await writeCalendarGovernanceOutboxEvent({
      workspaceId,
      topic: confirmation.mismatch
        ? 'scheduling.calendar_connection.classification_mismatch'
        : 'scheduling.calendar_connection.classification_required',
      aggregateId: connection.id,
      payload: {
        provider: 'microsoft',
        requestedPurpose: pending.connectionPurpose,
        suggestedPurpose: suggestedClassification.purpose,
        reasonCode: confirmation.reasonCode,
      },
    })
    return {
      ok: true as const,
      value: {
        connectionId: connection.id,
        classificationConfirmationRequired: true,
      },
    }
  }
  if (calendarProbe.ok) {
    await persistDiscoveredCalendars({
      workspaceId,
      connectionId: connection.id,
      calendars: calendarProbe.value,
    })
  }
  return {
    ok: true as const,
    value: {
      connectionId: connection.id,
      classificationConfirmationRequired: false,
    },
  }
}

export async function persistDiscoveredCalendars({
  workspaceId,
  connectionId,
  calendars,
}: {
  workspaceId: string
  connectionId: string
  calendars: ProviderCalendar[]
}) {
  const [connection, workspacePolicy] = await Promise.all([
    prisma.calendarConnection.findFirst({
      where: { id: connectionId, workspaceId },
      select: {
        ownershipType: true,
        connectionPurpose: true,
        accountEmail: true,
        availabilityBehavior: true,
        busyDisplayMode: true,
      },
    }),
    getWorkspaceCalendarConnectionPolicy(workspaceId),
  ])
  for (const calendar of calendars) {
    const classification = classifyCalendarConnectionPurpose({
      provider: 'microsoft',
      providerEmail: calendar.ownerEmail ?? connection?.accountEmail,
      tenantMetadata: calendar.raw,
      providerCalendarMetadata: calendar.raw,
      workspaceBusinessDomains: workspacePolicy.workspaceBusinessDomains,
      ownershipType: connection?.ownershipType,
    })
    const calendarPurpose =
      classification.purpose === CalendarConnectionPurpose.UNKNOWN && connection
        ? connection.connectionPurpose
        : classification.purpose
    const personalCalendar =
      calendarPurpose === CalendarConnectionPurpose.PERSONAL
    const writable = isWritableCalendar(calendar)
    const desiredDirection = writable
      ? CalendarSyncDirection.TWO_WAY
      : CalendarSyncDirection.IMPORT_ONLY
    const syncDirection = connection
      ? coerceCalendarSyncDirectionForPolicy({
          direction: desiredDirection,
          connection,
          policy: workspacePolicy,
        })
      : desiredDirection
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
        availabilityBehavior: personalCalendar
          ? toPersonalCalendarAvailabilityBehaviorPrisma(
              workspacePolicy.personalCalendarAvailabilityBehavior,
            )
          : connection?.availabilityBehavior,
        busyDisplayMode: personalCalendar
          ? toPersonalCalendarBusyDisplayModePrisma(
              workspacePolicy.personalCalendarBusyDisplayMode,
            )
          : connection?.busyDisplayMode,
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
        importEnabled:
          syncDirection !== CalendarSyncDirection.EXPORT_ONLY &&
          syncDirection !== CalendarSyncDirection.DISABLED,
        exportEnabled:
          syncDirection === CalendarSyncDirection.EXPORT_ONLY ||
          syncDirection === CalendarSyncDirection.TWO_WAY,
        defaultExportTarget: (calendar.isPrimary ?? false) && writable,
        syncDirection,
        metadata: calendar.raw as object,
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
        metadata: calendar.raw as object,
      },
    })
  }
}

export async function discoverMicrosoftCalendars({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}) {
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: MICROSOFT_PROVIDER },
    include: {
      workspaceMember: { select: { id: true } },
    },
  })
  if (!connection) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'Microsoft Outlook connection was not found.',
      retryable: false,
    }
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const providerConfig = getSchedulingProviderConfig('microsoft')
  const eligibility = resolveCalendarConnectionSyncEligibility({
    connection,
    workspacePolicy,
    ownerMember: connection.workspaceMember,
    providerHealth: providerConfig.status,
  })
  if (!eligibility.canDiscoverCalendars) {
    return {
      ok: false as const,
      code: eligibility.reasonCode,
      safeMessage:
        'This Microsoft Outlook connection is not eligible for calendar discovery.',
      retryable: false,
    }
  }
  const tokens = await loadConnectionTokens(connection)
  const result = await createMicrosoftCalendarProvider().listCalendars({
    workspaceId,
    connectionId,
    ...tokens,
  })
  if (!result.ok) return result
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

export async function updateConnectedMicrosoftCalendar({
  workspaceId,
  calendarId,
  selectedForSync,
  syncDirection,
  defaultExportTarget,
  calendarPurpose,
  actorWorkspaceMemberId,
  canManageScheduling = false,
}: {
  workspaceId: string
  calendarId: string
  selectedForSync?: boolean
  syncDirection?: string
  defaultExportTarget?: boolean
  calendarPurpose?: CalendarConnectionPurpose
  actorWorkspaceMemberId?: string
  canManageScheduling?: boolean
}) {
  const calendar = await prisma.connectedCalendar.findFirst({
    where: {
      id: calendarId,
      workspaceId,
      connection: { provider: MICROSOFT_PROVIDER },
    },
    include: {
      connection: {
        select: { ownershipType: true, workspaceMemberId: true },
      },
    },
  })
  if (!calendar) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'Microsoft Outlook was not found.',
      retryable: false,
    }
  }
  if (defaultExportTarget) {
    await prisma.connectedCalendar.updateMany({
      where: { workspaceId, id: { not: calendarId } },
      data: { defaultExportTarget: false },
    })
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  if (
    calendarPurpose &&
    (calendarPurpose === CalendarConnectionPurpose.WORKSPACE_SHARED ||
      calendarPurpose === CalendarConnectionPurpose.RESOURCE) &&
    !canManageScheduling
  ) {
    return {
      ok: false as const,
      code: 'purposeNotAllowed',
      safeMessage:
        'Only workspace admins can classify calendars as shared workspace or resource calendars.',
      retryable: false,
    }
  }
  const nextSyncDirection = syncDirection
    ? coerceCalendarSyncDirectionForPolicy({
        direction: toCalendarSyncDirection(syncDirection),
        connection: calendar.connection,
        policy: workspacePolicy,
      })
    : undefined
  const updated = await prisma.connectedCalendar.update({
    where: { id: calendarId },
    data: {
      selectedForSync,
      syncDirection: nextSyncDirection,
      defaultExportTarget,
      ...(calendarPurpose
        ? {
            calendarPurpose,
            classificationSource: canManageScheduling
              ? CalendarPurposeClassificationSource.ADMIN_CONFIRMED
              : CalendarPurposeClassificationSource.MEMBER_SELECTED,
            classificationConfidence: 1,
            classifiedAt: new Date(),
            classifiedByWorkspaceMemberId: actorWorkspaceMemberId,
            adminConfirmedAt: canManageScheduling ? new Date() : undefined,
            adminConfirmedByWorkspaceMemberId: canManageScheduling
              ? actorWorkspaceMemberId
              : undefined,
            availabilityBehavior:
              calendarPurpose === CalendarConnectionPurpose.PERSONAL
                ? toPersonalCalendarAvailabilityBehaviorPrisma(
                    workspacePolicy.personalCalendarAvailabilityBehavior,
                  )
                : undefined,
            busyDisplayMode:
              calendarPurpose === CalendarConnectionPurpose.PERSONAL
                ? toPersonalCalendarBusyDisplayModePrisma(
                    workspacePolicy.personalCalendarBusyDisplayMode,
                  )
                : undefined,
          }
        : {}),
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

export async function disconnectMicrosoftCalendarConnection({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}) {
  await prisma.calendarWatchChannel.updateMany({
    where: { workspaceId, connectionId },
    data: {
      status: CalendarWatchChannelStatus.STOPPED,
      stoppedAt: new Date(),
    },
  })
  await prisma.calendarConnection.updateMany({
    where: { id: connectionId, workspaceId, provider: MICROSOFT_PROVIDER },
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

export async function syncMicrosoftCalendarConnection({
  workspaceId,
  connectionId,
  workerId = `manual-${randomUUID()}`,
  dryRun = false,
}: {
  workspaceId: string
  connectionId: string
  workerId?: string
  dryRun?: boolean
}) {
  const startedAt = new Date()
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: MICROSOFT_PROVIDER },
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
      safeMessage: 'Microsoft Outlook connection was not found.',
      retryable: false,
    }
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const providerConfig = getSchedulingProviderConfig('microsoft')
  const eligibility = resolveCalendarConnectionSyncEligibility({
    connection,
    workspacePolicy,
    ownerMember: connection.workspaceMember,
    providerHealth: providerConfig.status,
  })
  if (!eligibility.canPull && !eligibility.canPush) {
    await recordCalendarSyncLog({
      workspaceId,
      connectionId,
      direction: CalendarSyncDirectionLog.TWO_WAY,
      operation: 'syncConnection',
      status: CalendarSyncLogStatus.SUCCEEDED,
      safeMessage: `Microsoft Outlook sync skipped: ${eligibility.reasonCode}.`,
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
  const tokens = await loadConnectionTokens(connection)
  const provider = createMicrosoftCalendarProvider()
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
        workspaceId,
        connectionId,
        ...tokens,
        calendarId: calendar.providerCalendarId,
        syncToken: cursor?.cursor,
        pageToken: cursor?.pageToken,
      })
      if (!pull.ok) {
        failures += 1
        await recordCalendarSyncLog({
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
                providerEtag: providerEvent.providerEtag,
                providerUpdatedAt: providerEvent.providerUpdatedAt
                  ? new Date(providerEvent.providerUpdatedAt)
                  : null,
                ownership: CalendarEventOwnership.EXTERNAL_ONLY,
                syncState: CalendarEventSyncState.SYNCED,
                syncHash,
                lastSyncOrigin: 'microsoft',
                originOperation: 'microsoft.pull.external_availability',
                lastSyncedAt: new Date(),
                lastPulledAt: new Date(),
                providerSnapshot: jsonInput({
                  kind: 'externalAvailability',
                  displayLabel: 'Unavailable',
                  startsAtUtc: providerEvent.startsAtUtc,
                  endsAtUtc: providerEvent.endsAtUtc,
                  provider: 'microsoft',
                  effect:
                    calendar.availabilityBehavior === 'BLOCK_AVAILABILITY'
                      ? 'blocking'
                      : 'suggestion',
                  privacyLevel: 'BUSY_ONLY',
                }),
                metadata: jsonInput({
                  connectionPurpose: calendar.calendarPurpose,
                  availabilityBehavior: calendar.availabilityBehavior,
                  busyDisplayMode: calendar.busyDisplayMode,
                }),
              },
              update: {
                providerEtag: providerEvent.providerEtag,
                providerUpdatedAt: providerEvent.providerUpdatedAt
                  ? new Date(providerEvent.providerUpdatedAt)
                  : null,
                syncState: CalendarEventSyncState.SYNCED,
                syncHash,
                lastSyncOrigin: 'microsoft',
                originOperation: 'microsoft.pull.external_availability',
                lastSyncedAt: new Date(),
                lastPulledAt: new Date(),
                providerSnapshot: jsonInput({
                  kind: 'externalAvailability',
                  displayLabel: 'Unavailable',
                  startsAtUtc: providerEvent.startsAtUtc,
                  endsAtUtc: providerEvent.endsAtUtc,
                  provider: 'microsoft',
                  effect:
                    calendar.availabilityBehavior === 'BLOCK_AVAILABILITY'
                      ? 'blocking'
                      : 'suggestion',
                  privacyLevel: 'BUSY_ONLY',
                }),
                metadata: jsonInput({
                  connectionPurpose: calendar.calendarPurpose,
                  availabilityBehavior: calendar.availabilityBehavior,
                  busyDisplayMode: calendar.busyDisplayMode,
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
                lastSyncOrigin: 'microsoft',
                originOperation: 'microsoft.pull.loop_ignored',
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
                provider: MICROSOFT_PROVIDER,
                conflictType: conflict.type,
                resolutionPolicy: connection.conflictPolicy,
                safeMessage: conflict.safeMessage,
                providerSnapshot: jsonInput(providerEvent.raw),
                skillifySnapshot: jsonInput(existing?.skillifySnapshot),
                metadata: jsonInput(conflict.metadata),
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
                providerEventId: providerEvent.id,
                providerSeriesId: providerEvent.recurringEventId,
                providerRecurringEventId: providerEvent.recurringEventId,
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
                lastSyncOrigin: 'microsoft',
                originOperation: 'microsoft.pull',
                syncHash,
                providerSnapshot: providerEvent.raw as object,
              },
              update: {
                providerSeriesId: providerEvent.recurringEventId,
                providerRecurringEventId: providerEvent.recurringEventId,
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
                lastSyncOrigin: 'microsoft',
                originOperation: 'microsoft.pull',
                syncHash,
                providerSnapshot: providerEvent.raw as object,
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
        const pushed = await provider.createEvent(
          { workspaceId, connectionId, ...tokens },
          payload,
        )
        if (!pushed.ok) {
          failures += 1
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
            originOperation: 'skillify.export',
            syncHash: computeGoogleSyncHash(payload),
            providerSnapshot: pushed.value.raw as object,
            skillifySnapshot: payload.raw as object,
          },
          update: {
            schedulingEventId: event.id,
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
            originOperation: 'skillify.export',
            syncHash: computeGoogleSyncHash(payload),
            providerSnapshot: pushed.value.raw as object,
            skillifySnapshot: payload.raw as object,
          },
        })
        processed += 1
      }
    }
  }

  const completedAt = new Date()
  await recordCalendarSyncLog({
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
        ? `${failures} Microsoft Outlook sync operations need attention.`
        : `Processed ${processed} Microsoft Outlook sync records.`,
    workerId,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  })
  await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: {
      syncStatus:
        failures > 0
          ? CalendarConnectionStatus.NEEDS_ATTENTION
          : CalendarConnectionStatus.CONNECTED,
      lastSuccessfulSyncAt: failures > 0 ? undefined : completedAt,
      nextSyncAt: new Date(
        completedAt.getTime() + connection.syncFrequencyMinutes * 60_000,
      ),
    },
  })
  return { ok: true as const, value: { processed, failures, dryRun } }
}

export async function renewMicrosoftCalendarWatchChannels({
  workspaceId,
  connectionId,
  webhookUrl,
}: {
  workspaceId: string
  connectionId: string
  webhookUrl: string
}) {
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: MICROSOFT_PROVIDER },
    include: {
      workspaceMember: { select: { id: true } },
      calendars: { where: { selectedForSync: true } },
    },
  })
  if (!connection) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'Microsoft Outlook connection was not found.',
      retryable: false,
    }
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const providerConfig = getSchedulingProviderConfig('microsoft')
  const eligibility = resolveCalendarConnectionSyncEligibility({
    connection,
    workspacePolicy,
    ownerMember: connection.workspaceMember,
    providerHealth: providerConfig.status,
  })
  if (!eligibility.canPull) {
    return { ok: true as const, value: { renewed: 0, skipped: true } }
  }
  const tokens = await loadConnectionTokens(connection)
  const provider = createMicrosoftCalendarProvider()
  let renewed = 0
  for (const calendar of connection.calendars) {
    const channelId = createMicrosoftWatchChannelId()
    const token = randomBytes(24).toString('hex')
    const result = await provider.watchCalendar({
      workspaceId,
      connectionId,
      ...tokens,
      calendarId: calendar.providerCalendarId,
      channelId,
      token,
      webhookUrl,
    })
    if (!result.ok) continue
    await prisma.calendarWatchChannel.upsert({
      where: {
        provider_channelId: {
          provider: MICROSOFT_PROVIDER,
          channelId: result.value.id,
        },
      },
      create: {
        workspaceId,
        connectionId,
        connectedCalendarId: calendar.id,
        provider: MICROSOFT_PROVIDER,
        providerCalendarId: calendar.providerCalendarId,
        channelId: result.value.id,
        resourceId: result.value.resourceId,
        resourceUri: result.value.resourceUri,
        tokenEncrypted: encryptNullable(result.value.token),
        expiresAt: result.value.expiresAt,
      },
      update: {
        resourceId: result.value.resourceId,
        resourceUri: result.value.resourceUri,
        tokenEncrypted: encryptNullable(result.value.token),
        expiresAt: result.value.expiresAt,
        status: CalendarWatchChannelStatus.ACTIVE,
        stoppedAt: null,
      },
    })
    renewed += 1
  }
  return { ok: true as const, value: { renewed } }
}

export async function recordMicrosoftWebhookNotification({
  channelId,
  resourceId,
  messageNumber,
  resourceState,
}: {
  channelId: string
  resourceId?: string | null
  messageNumber?: string | null
  resourceState?: string | null
}) {
  const channel = await prisma.calendarWatchChannel.findUnique({
    where: {
      provider_channelId: {
        provider: MICROSOFT_PROVIDER,
        channelId,
      },
    },
  })
  if (!channel) {
    return {
      ok: false as const,
      code: 'unknownChannel',
      safeMessage: 'Microsoft Outlook webhook channel was not recognized.',
      retryable: false,
    }
  }
  const connection = await prisma.calendarConnection.findFirst({
    where: {
      id: channel.connectionId,
      workspaceId: channel.workspaceId,
      provider: MICROSOFT_PROVIDER,
    },
    include: { workspaceMember: { select: { id: true } } },
  })
  if (!connection) {
    return {
      ok: false as const,
      code: 'connectionNotFound',
      safeMessage: 'Microsoft Outlook webhook connection was not found.',
      retryable: false,
    }
  }
  const workspacePolicy = await getWorkspaceCalendarConnectionPolicy(
    channel.workspaceId,
  )
  const providerConfig = getSchedulingProviderConfig('microsoft')
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
      safeMessage: `Microsoft Outlook webhook delivery was ignored: ${eligibility.reasonCode}.`,
      retryable: false,
    }
  }
  const decision = classifyGoogleWebhookDelivery({
    channelResourceId: channel.resourceId,
    receivedResourceId: resourceId,
    lastMessageNumber: channel.lastMessageNumber,
    messageNumber,
    expiresAt: channel.expiresAt,
  })
  if (decision.action === 'ignore') {
    if (decision.reason === 'expiredChannel') {
      await prisma.calendarWatchChannel.update({
        where: { id: channel.id },
        data: {
          status: CalendarWatchChannelStatus.EXPIRED,
          lastMessageNumber: messageNumber,
          lastNotificationAt: new Date(),
          metadata: { resourceState, ignoredReason: decision.reason },
        },
      })
    }
    return {
      ok: false as const,
      code: decision.reason,
      safeMessage:
        decision.reason === 'resourceMismatch'
          ? 'Microsoft Outlook webhook resource did not match the channel.'
          : `Microsoft Outlook webhook delivery was ignored: ${decision.reason}.`,
      retryable: decision.reason === 'expiredChannel',
    }
  }
  await prisma.calendarWatchChannel.update({
    where: { id: channel.id },
    data: {
      lastMessageNumber: messageNumber,
      lastNotificationAt: new Date(),
      metadata: { resourceState },
    },
  })
  await prisma.calendarEventMapping.updateMany({
    where: {
      workspaceId: channel.workspaceId,
      connectedCalendarId: channel.connectedCalendarId ?? undefined,
    },
    data: { syncState: CalendarEventSyncState.PENDING_PULL },
  })
  return {
    ok: true as const,
    value: {
      workspaceId: channel.workspaceId,
      connectionId: channel.connectionId,
      connectedCalendarId: channel.connectedCalendarId,
    },
  }
}

export async function previewMicrosoftCalendarInitialSync({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}) {
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: MICROSOFT_PROVIDER },
    include: {
      workspaceMember: { select: { id: true } },
      calendars: {
        where: {
          selectedForSync: true,
          syncDirection: {
            in: [
              CalendarSyncDirection.IMPORT_ONLY,
              CalendarSyncDirection.TWO_WAY,
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
      safeMessage: 'Microsoft Outlook connection was not found.',
      retryable: false,
    }
  }
  const workspacePolicy =
    await getWorkspaceCalendarConnectionPolicy(workspaceId)
  const providerConfig = getSchedulingProviderConfig('microsoft')
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
      safeMessage:
        'This Microsoft Outlook connection is not eligible for import preview.',
      retryable: false,
    }
  }
  const tokens = await loadConnectionTokens(connection)
  const provider = createMicrosoftCalendarProvider()
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
  const microsoftEvents = []
  const skipped = []
  for (const calendar of connection.calendars) {
    const pulled = await provider.pullChanges({
      workspaceId,
      connectionId,
      ...tokens,
      calendarId: calendar.providerCalendarId,
    })
    if (!pulled.ok) {
      skipped.push({
        providerEventId: calendar.providerCalendarId,
        reason: pulled.safeMessage,
      })
      continue
    }
    microsoftEvents.push(
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
    googleEvents: microsoftEvents,
    mappings,
  })
  return {
    ok: true as const,
    value: {
      ...preview,
      eventsSkipped: [...preview.eventsSkipped, ...skipped],
      dryRun: true,
    },
  }
}

export async function resolveMicrosoftCalendarConflict({
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
    | 'keepMicrosoft'
    | 'merge'
    | 'ignore'
    | 'retryLater'
  rememberDecision?: boolean
}) {
  const conflict = await prisma.calendarSyncConflict.findFirst({
    where: { id: conflictId, workspaceId, provider: MICROSOFT_PROVIDER },
    include: { mapping: true },
  })
  if (!conflict) {
    return {
      ok: false as const,
      code: 'notFound',
      safeMessage: 'Microsoft Outlook conflict was not found.',
      retryable: false,
    }
  }
  if (resolution === 'retryLater') {
    await prisma.calendarSyncConflict.update({
      where: { id: conflict.id },
      data: {
        resolution,
        metadata: {
          ...(conflict.metadata && typeof conflict.metadata === 'object'
            ? (conflict.metadata as object)
            : {}),
          retryRequestedAt: new Date().toISOString(),
        },
      },
    })
    return { ok: true as const, value: { conflictId, resolution } }
  }

  const mappingState =
    resolution === 'keepSkillify'
      ? CalendarEventSyncState.PENDING_PUSH
      : resolution === 'ignore'
        ? CalendarEventSyncState.SYNCED
        : CalendarEventSyncState.PENDING_PULL
  await prisma.$transaction(async (tx) => {
    await tx.calendarSyncConflict.update({
      where: { id: conflict.id },
      data: {
        status: CalendarSyncConflictStatus.RESOLVED,
        resolution,
        resolvedAt: new Date(),
        resolvedByUserId: actorUserId,
        metadata: {
          ...(conflict.metadata && typeof conflict.metadata === 'object'
            ? (conflict.metadata as object)
            : {}),
          rememberDecision,
        },
      },
    })
    if (conflict.mappingId) {
      await tx.calendarEventMapping.update({
        where: { id: conflict.mappingId },
        data: {
          syncState: mappingState,
          conflictResolvedAt: new Date(),
          conflictType: conflict.conflictType,
          conflictMetadata: conflict.metadata as Prisma.InputJsonValue,
          lastSyncOrigin:
            resolution === 'keepSkillify' ? 'skillify' : 'microsoft',
          originOperation: `conflict.${resolution}`,
        },
      })
    }
  })
  return { ok: true as const, value: { conflictId, resolution } }
}

export async function inspectMicrosoftCalendarMappingIntegrity({
  workspaceId,
  repair = false,
}: {
  workspaceId: string
  repair?: boolean
}) {
  const [mappings, events] = await Promise.all([
    prisma.calendarEventMapping.findMany({
      where: { workspaceId },
    }),
    prisma.schedulingEvent.findMany({
      where: { workspaceId },
      select: { id: true },
    }),
  ])
  const findings = inspectGoogleMappingIntegrity({
    mappings,
    knownSkillifyEventIds: new Set(events.map((event) => event.id)),
  })
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
          originOperation: 'repair.missing_skillify_event',
        },
      })
      repaired += result.count
    }
  }
  await prisma.calendarSyncDiagnostic.create({
    data: {
      workspaceId,
      workerKind: 'microsoft.mappingIntegrity',
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
          ? `${findings.length} Microsoft Outlook mapping integrity findings.`
          : 'Microsoft Outlook mappings passed integrity checks.',
      metadata: jsonInput({ findings, repaired }),
    },
  })
  return { ok: true as const, value: { findings, repaired } }
}

export async function recordCalendarSyncLog({
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
      metadata,
    },
  })
}
