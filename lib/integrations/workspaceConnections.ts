import { prisma } from '@/lib/db'
import {
  decryptIntegrationPayload,
  encryptIntegrationPayload,
  maskSecretHint,
} from '@/lib/integrations/crypto'
import {
  getIntegrationProviderDefinition,
  type IntegrationConnectionStatus,
  type IntegrationProviderId,
} from '@/lib/integrations/providerRegistry'

export type SafeWorkspaceIntegrationConnection = {
  id: string
  workspaceId: string
  providerId: string
  category: string
  ownershipType: string
  status: IntegrationConnectionStatus
  externalAccountId: string | null
  externalAccountLabel: string | null
  credentialHint: string | null
  grantedScopes: unknown
  tokenExpiresAt: Date | null
  refreshStatus: string | null
  providerMetadata: unknown
  connectedByUserId: string | null
  connectedByWorkspaceMemberId: string | null
  connectedAt: Date | null
  lastValidatedAt: Date | null
  lastSuccessfulSyncAt: Date | null
  lastErrorCode: string | null
  lastErrorAt: Date | null
  disabledAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const calendarProviderToIntegrationProvider = {
  GOOGLE: 'googleCalendar',
  OUTLOOK: 'microsoftCalendar',
  CALDAV: 'caldav',
  APPLE_ICLOUD: 'caldav',
  ICS: 'caldav',
} as const

function sanitizeConnection(connection: {
  id: string
  workspaceId: string
  providerId: string
  category: string
  ownershipType: string
  status: string
  externalAccountId: string | null
  externalAccountLabel: string | null
  credentialHint: string | null
  grantedScopes: unknown
  tokenExpiresAt: Date | null
  refreshStatus: string | null
  providerMetadata: unknown
  connectedByUserId: string | null
  connectedByWorkspaceMemberId: string | null
  connectedAt: Date | null
  lastValidatedAt: Date | null
  lastSuccessfulSyncAt: Date | null
  lastErrorCode: string | null
  lastErrorAt: Date | null
  disabledAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): SafeWorkspaceIntegrationConnection {
  return {
    ...connection,
    status: connection.status as IntegrationConnectionStatus,
  }
}

export async function listWorkspaceIntegrationConnections({
  workspaceId,
}: {
  workspaceId: string
}): Promise<SafeWorkspaceIntegrationConnection[]> {
  const [connections, calendarConnections] = await Promise.all([
    prisma.workspaceIntegrationConnection.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.calendarConnection.findMany({
      where: {
        workspaceId,
        disconnectedAt: null,
        provider: {
          in: ['GOOGLE', 'OUTLOOK', 'CALDAV', 'APPLE_ICLOUD', 'ICS'],
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  const safeConnections = connections.map(sanitizeConnection)
  const existingKeys = new Set(
    safeConnections.map(
      (connection) =>
        `${connection.providerId}:${connection.externalAccountId ?? ''}`,
    ),
  )
  const calendarManagementConnections = calendarConnections
    .map((connection): SafeWorkspaceIntegrationConnection | null => {
      const providerId =
        calendarProviderToIntegrationProvider[
          connection.provider as keyof typeof calendarProviderToIntegrationProvider
        ]
      if (!providerId) return null
      const externalAccountId =
        connection.providerAccountId &&
        !connection.providerAccountId.startsWith('pending:')
          ? connection.providerAccountId
          : connection.id
      if (existingKeys.has(`${providerId}:${externalAccountId}`)) return null
      const connected =
        connection.syncStatus === 'CONNECTED' ||
        connection.syncStatus === 'INITIAL_SYNC'
      return {
        id: `calendar:${connection.id}`,
        workspaceId: connection.workspaceId,
        providerId,
        category: 'calendar',
        ownershipType: 'workspaceOAuth',
        status: connected
          ? 'connected'
          : connection.syncStatus === 'CONNECTING'
            ? 'connecting'
            : connection.syncStatus === 'NEEDS_ATTENTION'
              ? 'actionRequired'
              : 'degraded',
        externalAccountId,
        externalAccountLabel:
          connection.accountEmail ?? connection.displayName ?? null,
        credentialHint: null,
        grantedScopes: connection.scopes,
        tokenExpiresAt: connection.tokenExpiresAt,
        refreshStatus: connection.tokenStatus,
        providerMetadata: {
          source: 'CalendarConnection',
          calendarConnectionId: connection.id,
          syncStatus: connection.syncStatus,
          ownershipType: connection.ownershipType,
          connectionPurpose: connection.connectionPurpose,
        },
        connectedByUserId: connection.connectedByUserId,
        connectedByWorkspaceMemberId: connection.connectedByWorkspaceMemberId,
        connectedAt: connection.createdAt,
        lastValidatedAt: connection.lastValidatedAt,
        lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
        lastErrorCode: connection.lastErrorCode,
        lastErrorAt: connection.lastAttemptedSyncAt,
        disabledAt: connection.disabledAt,
        revokedAt: connection.disconnectedAt,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      }
    })
    .filter((connection): connection is SafeWorkspaceIntegrationConnection =>
      Boolean(connection),
    )
  return [...safeConnections, ...calendarManagementConnections]
}

export async function getWorkspaceIntegrationConnection({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}): Promise<SafeWorkspaceIntegrationConnection | null> {
  const connection = await prisma.workspaceIntegrationConnection.findFirst({
    where: { id: connectionId, workspaceId },
  })
  return connection ? sanitizeConnection(connection) : null
}

export async function upsertWorkspaceApiKeyConnection({
  workspaceId,
  providerId,
  apiKey,
  externalAccountId,
  externalAccountLabel,
  providerMetadata,
  connectedByUserId,
  connectedByWorkspaceMemberId,
  status = 'actionRequired',
}: {
  workspaceId: string
  providerId: Extract<IntegrationProviderId, 'resend'>
  apiKey: string
  externalAccountId: string
  externalAccountLabel: string
  providerMetadata?: Record<string, unknown>
  connectedByUserId?: string
  connectedByWorkspaceMemberId?: string
  status?: IntegrationConnectionStatus
}): Promise<SafeWorkspaceIntegrationConnection> {
  const provider = getIntegrationProviderDefinition(providerId)
  if (!provider)
    throw new Error(`Unsupported integration provider: ${providerId}`)

  const encryptedCredentials = encryptIntegrationPayload({ apiKey })
  const credentialHint = maskSecretHint(apiKey)
  const connection = await prisma.workspaceIntegrationConnection.upsert({
    where: {
      workspaceId_providerId_externalAccountId: {
        workspaceId,
        providerId,
        externalAccountId,
      },
    },
    update: {
      category: provider.category,
      ownershipType: provider.credentialOwnership,
      status,
      externalAccountLabel,
      encryptedCredentials,
      credentialHint,
      providerMetadata: (providerMetadata ?? undefined) as any,
      connectedByUserId,
      connectedByWorkspaceMemberId,
      connectedAt: new Date(),
      revokedAt: null,
      disabledAt: null,
      lastErrorCode: null,
      lastErrorAt: null,
    },
    create: {
      workspaceId,
      providerId,
      category: provider.category,
      ownershipType: provider.credentialOwnership,
      status,
      externalAccountId,
      externalAccountLabel,
      encryptedCredentials,
      credentialHint,
      providerMetadata: (providerMetadata ?? undefined) as any,
      connectedByUserId,
      connectedByWorkspaceMemberId,
      connectedAt: new Date(),
    },
  })
  return sanitizeConnection(connection)
}

export async function upsertCalendarWorkspaceIntegrationConnection({
  workspaceId,
  providerId,
  calendarConnectionId,
}: {
  workspaceId: string
  providerId: Extract<
    IntegrationProviderId,
    'googleCalendar' | 'microsoftCalendar' | 'caldav'
  >
  calendarConnectionId: string
}): Promise<SafeWorkspaceIntegrationConnection | null> {
  const [provider, calendarConnection] = await Promise.all([
    Promise.resolve(getIntegrationProviderDefinition(providerId)),
    prisma.calendarConnection.findFirst({
      where: { id: calendarConnectionId, workspaceId },
    }),
  ])
  if (!provider || !calendarConnection) return null

  const externalAccountId =
    calendarConnection.providerAccountId &&
    !calendarConnection.providerAccountId.startsWith('pending:')
      ? calendarConnection.providerAccountId
      : calendarConnection.id
  const connected =
    calendarConnection.syncStatus === 'CONNECTED' ||
    calendarConnection.syncStatus === 'INITIAL_SYNC'
  const connection = await prisma.workspaceIntegrationConnection.upsert({
    where: {
      workspaceId_providerId_externalAccountId: {
        workspaceId,
        providerId,
        externalAccountId,
      },
    },
    update: {
      category: provider.category,
      ownershipType: provider.credentialOwnership,
      status: connected ? 'connected' : 'actionRequired',
      externalAccountLabel:
        calendarConnection.accountEmail ?? calendarConnection.displayName,
      grantedScopes: (calendarConnection.scopes ?? undefined) as any,
      tokenExpiresAt: calendarConnection.tokenExpiresAt,
      refreshStatus: calendarConnection.tokenStatus,
      providerMetadata: {
        source: 'CalendarConnection',
        calendarConnectionId: calendarConnection.id,
        syncStatus: calendarConnection.syncStatus,
        ownershipType: calendarConnection.ownershipType,
        connectionPurpose: calendarConnection.connectionPurpose,
      },
      connectedByUserId: calendarConnection.connectedByUserId,
      connectedByWorkspaceMemberId:
        calendarConnection.connectedByWorkspaceMemberId,
      connectedAt: calendarConnection.createdAt,
      lastValidatedAt: calendarConnection.lastValidatedAt,
      lastSuccessfulSyncAt: calendarConnection.lastSuccessfulSyncAt,
      lastErrorCode: calendarConnection.lastErrorCode,
      lastErrorAt: calendarConnection.lastAttemptedSyncAt,
      disabledAt: calendarConnection.disabledAt,
      revokedAt: calendarConnection.disconnectedAt,
    },
    create: {
      workspaceId,
      providerId,
      category: provider.category,
      ownershipType: provider.credentialOwnership,
      status: connected ? 'connected' : 'actionRequired',
      externalAccountId,
      externalAccountLabel:
        calendarConnection.accountEmail ?? calendarConnection.displayName,
      grantedScopes: (calendarConnection.scopes ?? undefined) as any,
      tokenExpiresAt: calendarConnection.tokenExpiresAt,
      refreshStatus: calendarConnection.tokenStatus,
      providerMetadata: {
        source: 'CalendarConnection',
        calendarConnectionId: calendarConnection.id,
        syncStatus: calendarConnection.syncStatus,
        ownershipType: calendarConnection.ownershipType,
        connectionPurpose: calendarConnection.connectionPurpose,
      },
      connectedByUserId: calendarConnection.connectedByUserId,
      connectedByWorkspaceMemberId:
        calendarConnection.connectedByWorkspaceMemberId,
      connectedAt: calendarConnection.createdAt,
      lastValidatedAt: calendarConnection.lastValidatedAt,
      lastSuccessfulSyncAt: calendarConnection.lastSuccessfulSyncAt,
      lastErrorCode: calendarConnection.lastErrorCode,
      lastErrorAt: calendarConnection.lastAttemptedSyncAt,
      disabledAt: calendarConnection.disabledAt,
      revokedAt: calendarConnection.disconnectedAt,
    },
  })
  return sanitizeConnection(connection)
}

export async function readWorkspaceConnectionCredentials({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}): Promise<Record<string, unknown> | null> {
  const connection = await prisma.workspaceIntegrationConnection.findFirst({
    where: { id: connectionId, workspaceId },
    select: { encryptedCredentials: true },
  })
  if (!connection?.encryptedCredentials) return null
  return decryptIntegrationPayload(connection.encryptedCredentials)
}

export async function disconnectWorkspaceIntegrationConnection({
  workspaceId,
  connectionId,
}: {
  workspaceId: string
  connectionId: string
}): Promise<SafeWorkspaceIntegrationConnection | null> {
  const existing = await prisma.workspaceIntegrationConnection.findFirst({
    where: { id: connectionId, workspaceId },
    select: { id: true },
  })
  if (!existing) return null
  const connection = await prisma.workspaceIntegrationConnection.update({
    where: { id: existing.id },
    data: {
      encryptedCredentials: null,
      status: 'revoked',
      revokedAt: new Date(),
      disabledAt: new Date(),
    },
  })
  return sanitizeConnection(connection)
}
