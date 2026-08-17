import { decryptIntegrationPayload } from '@/lib/integrations/crypto'
import {
  getIntegrationProviderDefinition,
  resolveIntegrationProviderAvailability,
  type IntegrationProviderAvailability,
  type IntegrationProviderId,
} from '@/lib/integrations/providerRegistry'
import type { SafeWorkspaceIntegrationConnection } from '@/lib/integrations/workspaceConnections'

export type IntegrationHealthState =
  | 'healthy'
  | 'degraded'
  | 'actionRequired'
  | 'reconnectRequired'
  | 'expired'
  | 'unavailable'
  | 'unknown'
  | 'error'

export type IntegrationHealthResult = {
  state: IntegrationHealthState
  label: string
  safeMessage: string
  lastCheckedAt: Date | null
  lastSuccessfulSyncAt: Date | null
  stale: boolean
  requiredAction?: string
}

const defaultStaleMs = 24 * 60 * 60 * 1000

function isStale(date: Date | null | undefined, now: Date) {
  if (!date) return true
  return now.getTime() - date.getTime() > defaultStaleMs
}

export function resolveIntegrationHealth({
  providerId,
  connection = null,
  availability,
  now = new Date(),
}: {
  providerId: IntegrationProviderId
  connection?: SafeWorkspaceIntegrationConnection | null
  availability?: IntegrationProviderAvailability
  now?: Date
}): IntegrationHealthResult {
  const provider = getIntegrationProviderDefinition(providerId)
  const resolvedAvailability =
    availability ??
    (provider ? resolveIntegrationProviderAvailability({ provider }) : null)

  if (!provider || !resolvedAvailability) {
    return {
      state: 'unknown',
      label: 'Unknown',
      safeMessage: 'This integration provider is not registered.',
      lastCheckedAt: null,
      lastSuccessfulSyncAt: null,
      stale: true,
      requiredAction: 'Contact Skillify support.',
    }
  }

  if (
    ['configurationRequired', 'comingSoon', 'unavailable'].includes(
      resolvedAvailability.status,
    )
  ) {
    return {
      state:
        resolvedAvailability.status === 'configurationRequired'
          ? 'actionRequired'
          : 'unavailable',
      label:
        resolvedAvailability.status === 'configurationRequired'
          ? 'Action required'
          : 'Unavailable',
      safeMessage: resolvedAvailability.safeMessage,
      lastCheckedAt: null,
      lastSuccessfulSyncAt: null,
      stale: true,
      requiredAction: resolvedAvailability.safeMessage,
    }
  }

  if (!connection) {
    return {
      state: 'unknown',
      label: 'Not connected',
      safeMessage: 'No workspace connection has been established.',
      lastCheckedAt: null,
      lastSuccessfulSyncAt: null,
      stale: true,
      requiredAction: 'Connect this provider.',
    }
  }

  if (connection.status === 'expired') {
    return {
      state: 'expired',
      label: 'Expired',
      safeMessage: 'This connection has expired and needs to be reconnected.',
      lastCheckedAt: connection.lastValidatedAt,
      lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
      stale: isStale(connection.lastValidatedAt, now),
      requiredAction: 'Reconnect this provider.',
    }
  }

  if (connection.status === 'revoked') {
    return {
      state: 'reconnectRequired',
      label: 'Reconnect required',
      safeMessage: 'The stored credentials were removed or revoked.',
      lastCheckedAt: connection.lastValidatedAt,
      lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
      stale: isStale(connection.lastValidatedAt, now),
      requiredAction: 'Reconnect this provider.',
    }
  }

  if (connection.status === 'actionRequired') {
    return {
      state: 'actionRequired',
      label: 'Action required',
      safeMessage:
        'This connection needs setup before all capabilities are ready.',
      lastCheckedAt: connection.lastValidatedAt,
      lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
      stale: isStale(connection.lastValidatedAt, now),
      requiredAction: 'Finish provider setup.',
    }
  }

  if (connection.lastErrorCode) {
    return {
      state: 'degraded',
      label: 'Degraded',
      safeMessage: 'The last provider operation reported a safe error.',
      lastCheckedAt: connection.lastValidatedAt,
      lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
      stale: isStale(connection.lastValidatedAt, now),
      requiredAction: 'Test the connection.',
    }
  }

  return {
    state: connection.status === 'connected' ? 'healthy' : 'unknown',
    label: connection.status === 'connected' ? 'Healthy' : 'Unknown',
    safeMessage:
      connection.status === 'connected'
        ? 'The last local health check found no action required.'
        : 'Connection status is not fully established.',
    lastCheckedAt: connection.lastValidatedAt,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
    stale: isStale(connection.lastValidatedAt, now),
  }
}

export function canDecryptWorkspaceConnection(connection: unknown) {
  const encryptedCredentials =
    connection && typeof connection === 'object'
      ? (connection as { encryptedCredentials?: string | null })
          .encryptedCredentials
      : null
  if (!encryptedCredentials) return true
  try {
    decryptIntegrationPayload(encryptedCredentials)
    return true
  } catch {
    return false
  }
}
