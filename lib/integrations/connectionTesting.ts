import { prisma } from '@/lib/db'
import {
  canDecryptWorkspaceConnection,
  resolveIntegrationHealth,
  type IntegrationHealthResult,
} from '@/lib/integrations/health'
import {
  resolveIntegrationCapabilities,
  type IntegrationCapabilityResult,
} from '@/lib/integrations/capabilities'
import {
  getIntegrationProviderDefinition,
  resolveIntegrationProviderAvailability,
  type IntegrationProviderId,
} from '@/lib/integrations/providerRegistry'
import {
  getWorkspaceIntegrationConnection,
  type SafeWorkspaceIntegrationConnection,
} from '@/lib/integrations/workspaceConnections'

export type IntegrationTestCheckState =
  | 'passed'
  | 'failed'
  | 'warning'
  | 'skipped'
  | 'unavailable'

export type IntegrationTestCheck = {
  id: string
  label: string
  result: IntegrationTestCheckState
  safeExplanation: string
  requiredAction?: string
  latencyMs?: number
}

export type IntegrationTestResult = {
  providerId: IntegrationProviderId
  connectionId: string
  testedAt: string
  result: 'passed' | 'warning' | 'failed' | 'unavailable'
  checks: IntegrationTestCheck[]
  capabilities: IntegrationCapabilityResult[]
  health: IntegrationHealthResult | null
  requiredAction?: string
}

function summarizeChecks(checks: IntegrationTestCheck[]) {
  if (checks.some((check) => check.result === 'failed')) return 'failed'
  if (checks.some((check) => check.result === 'warning')) return 'warning'
  if (checks.every((check) => check.result === 'unavailable'))
    return 'unavailable'
  return 'passed'
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function buildLocalChecks({
  providerId,
  connection,
}: {
  providerId: IntegrationProviderId
  connection: SafeWorkspaceIntegrationConnection
}): IntegrationTestCheck[] {
  const metadata = metadataObject(connection.providerMetadata)
  const checks: IntegrationTestCheck[] = [
    {
      id: 'connection-status',
      label: 'Connection status',
      result:
        connection.status === 'connected'
          ? 'passed'
          : connection.status === 'actionRequired'
            ? 'warning'
            : 'failed',
      safeExplanation:
        connection.status === 'connected'
          ? 'The workspace connection is marked connected.'
          : `The workspace connection is ${connection.status}.`,
      requiredAction:
        connection.status === 'connected'
          ? undefined
          : 'Reconnect or finish provider setup.',
    },
    {
      id: 'credential-storage',
      label: 'Credential storage',
      result: canDecryptWorkspaceConnection(connection) ? 'passed' : 'failed',
      safeExplanation: canDecryptWorkspaceConnection(connection)
        ? 'Stored credential payload is decryptable or this management record delegates to provider-specific storage.'
        : 'Stored credential payload could not be decrypted.',
      requiredAction: canDecryptWorkspaceConnection(connection)
        ? undefined
        : 'Reconnect this provider.',
    },
  ]

  if (providerId === 'resend') {
    const verified = metadata.domainStatus === 'verified'
    checks.push({
      id: 'resend-domain',
      label: 'Sending domain',
      result: verified ? 'passed' : 'warning',
      safeExplanation: verified
        ? 'The configured Resend domain is marked verified.'
        : 'The configured Resend domain still needs verification.',
      requiredAction: verified
        ? undefined
        : 'Verify the sending domain in Resend.',
    })
  }

  if (providerId === 'twilio') {
    checks.push({
      id: 'twilio-live-connect',
      label: 'Twilio authorization',
      result: 'unavailable',
      safeExplanation:
        'Live Twilio Connect testing is deferred until customer authorization is implemented.',
      requiredAction: 'Finish Twilio Connect setup in a later phase.',
    })
  }

  if (
    providerId === 'googleCalendar' ||
    providerId === 'microsoftCalendar' ||
    providerId === 'caldav'
  ) {
    checks.push({
      id: 'calendar-source',
      label: 'Calendar sync source',
      result: metadata.source === 'CalendarConnection' ? 'passed' : 'warning',
      safeExplanation:
        metadata.source === 'CalendarConnection'
          ? 'Live sync remains managed by the existing CalendarConnection record.'
          : 'This connection is not linked to a live calendar sync record.',
      requiredAction:
        metadata.source === 'CalendarConnection'
          ? undefined
          : 'Reconnect from Scheduling Settings.',
    })
  }

  return checks
}

export async function testWorkspaceIntegrationConnection({
  workspaceId,
  providerId,
  connectionId,
}: {
  workspaceId: string
  providerId: IntegrationProviderId
  connectionId: string
}): Promise<IntegrationTestResult> {
  const provider = getIntegrationProviderDefinition(providerId)
  if (!provider) {
    return {
      providerId,
      connectionId,
      testedAt: new Date().toISOString(),
      result: 'unavailable',
      checks: [
        {
          id: 'provider-registry',
          label: 'Provider registry',
          result: 'unavailable',
          safeExplanation: 'This provider is not registered.',
        },
      ],
      capabilities: [],
      health: null,
    }
  }
  const availability = resolveIntegrationProviderAvailability({
    provider,
    workspaceId,
  })
  if (provider.testConnection.support !== 'supported') {
    return {
      providerId,
      connectionId,
      testedAt: new Date().toISOString(),
      result: 'unavailable',
      checks: [
        {
          id: 'test-connection-support',
          label: 'Test Connection support',
          result: 'unavailable',
          safeExplanation: provider.testConnection.safeCustomerDescription,
          requiredAction:
            provider.testConnection.support === 'deferred'
              ? 'This provider test is deferred to a later integration phase.'
              : undefined,
        },
      ],
      capabilities: [],
      health: null,
      requiredAction:
        provider.testConnection.support === 'deferred'
          ? 'This provider test is deferred to a later integration phase.'
          : undefined,
    }
  }
  if (
    !availability.canStartConnection &&
    availability.status !== 'notConnected'
  ) {
    return {
      providerId,
      connectionId,
      testedAt: new Date().toISOString(),
      result: 'unavailable',
      checks: [
        {
          id: 'platform-availability',
          label: 'Skillify provider configuration',
          result: 'unavailable',
          safeExplanation: availability.safeMessage,
          requiredAction: availability.safeMessage,
        },
      ],
      capabilities: [],
      health: null,
      requiredAction: availability.safeMessage,
    }
  }

  const normalizedConnectionId = connectionId.startsWith('calendar:')
    ? connectionId.slice('calendar:'.length)
    : connectionId
  let connection = await getWorkspaceIntegrationConnection({
    workspaceId,
    connectionId: normalizedConnectionId,
  })

  if (!connection && connectionId.startsWith('calendar:')) {
    const projected = (await import('@/lib/integrations/workspaceConnections'))
      .listWorkspaceIntegrationConnections
    connection =
      (await projected({ workspaceId })).find(
        (item) => item.id === connectionId,
      ) ?? null
  }

  if (!connection) {
    return {
      providerId,
      connectionId,
      testedAt: new Date().toISOString(),
      result: 'failed',
      checks: [
        {
          id: 'workspace-connection',
          label: 'Workspace connection',
          result: 'failed',
          safeExplanation:
            'The requested connection was not found in this workspace.',
          requiredAction: 'Reconnect this provider.',
        },
      ],
      capabilities: [],
      health: null,
      requiredAction: 'Reconnect this provider.',
    }
  }

  const checks = buildLocalChecks({ providerId, connection })
  const result = summarizeChecks(checks)
  const testedAt = new Date()
  const capabilities = resolveIntegrationCapabilities({
    provider,
    availability,
    connection,
  })
  const health = resolveIntegrationHealth({
    providerId,
    connection,
    availability,
    now: testedAt,
  })
  if (!connection.id.startsWith('calendar:')) {
    await prisma.workspaceIntegrationConnection.updateMany({
      where: { id: connection.id, workspaceId },
      data: {
        lastValidatedAt: testedAt,
        lastErrorCode: result === 'failed' ? 'connectionTestFailed' : null,
        lastErrorAt: result === 'failed' ? testedAt : null,
      },
    })
  }

  return {
    providerId,
    connectionId,
    testedAt: testedAt.toISOString(),
    result,
    checks,
    capabilities,
    health,
    requiredAction: checks.find((check) => check.requiredAction)
      ?.requiredAction,
  }
}
