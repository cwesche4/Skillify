import type {
  IntegrationProviderAvailability,
  IntegrationProviderDefinition,
} from '@/lib/integrations/providerRegistry'
import type { SafeWorkspaceIntegrationConnection } from '@/lib/integrations/workspaceConnections'

export type IntegrationCapabilityState =
  | 'available'
  | 'blocked'
  | 'notGranted'
  | 'unsupported'

export type IntegrationCapabilityResult = {
  id: string
  label: string
  supportedByProvider: boolean
  granted: boolean
  available: boolean
  state: IntegrationCapabilityState
  blockedReason?: string
  requiredAction?: string
  source: 'providerRegistry' | 'workspaceConnection'
  lastValidatedAt: Date | null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isResendCapabilityBlocked({
  capabilityId,
  connection,
}: {
  capabilityId: string
  connection: SafeWorkspaceIntegrationConnection | null
}) {
  if (!connection || connection.providerId !== 'resend') return null
  const metadata = metadataObject(connection.providerMetadata)
  const domainStatus = String(metadata.domainStatus ?? '')
  if (
    ['email.send', 'brandedSender', 'domainVerification'].includes(
      capabilityId,
    ) &&
    domainStatus !== 'verified'
  ) {
    return {
      blockedReason: 'workspaceSenderUnverified',
      requiredAction: 'Verify the sending domain in Resend.',
    }
  }
  return null
}

function isTwilioCapabilityBlocked({
  capabilityId,
  connection,
}: {
  capabilityId: string
  connection: SafeWorkspaceIntegrationConnection | null
}) {
  if (!connection || connection.providerId !== 'twilio') return null
  const metadata = metadataObject(connection.providerMetadata)
  if (capabilityId === 'sms.send' && metadata.smsCapability !== 'ready') {
    return {
      blockedReason: 'twilioSmsNotReady',
      requiredAction:
        'Finish Twilio sender and messaging compliance setup before sending SMS.',
    }
  }
  return null
}

export function resolveIntegrationCapabilities({
  provider,
  availability,
  connection = null,
}: {
  provider: IntegrationProviderDefinition | IntegrationProviderAvailability
  availability?: IntegrationProviderAvailability
  connection?: SafeWorkspaceIntegrationConnection | null
}): IntegrationCapabilityResult[] {
  const providerStatus = availability?.status ?? 'notConnected'
  const providerCapabilities = new Set(provider.capabilities)
  const grantedScopes = new Set(asStringArray(connection?.grantedScopes))
  const labels =
    'capabilityLabels' in provider ? (provider.capabilityLabels ?? {}) : {}
  const isConnected =
    connection?.status === 'connected' || connection?.status === 'degraded'

  return provider.capabilities.map((capabilityId) => {
    const supportedByProvider = providerCapabilities.has(capabilityId)
    const granted =
      !connection ||
      grantedScopes.size === 0 ||
      grantedScopes.has(capabilityId) ||
      (capabilityId === 'calendar.read' &&
        [...grantedScopes].some((scope) => scope.includes('calendar'))) ||
      (capabilityId === 'calendar.write' &&
        [...grantedScopes].some(
          (scope) => scope.includes('calendar') && !scope.includes('readonly'),
        ))
    const providerBlocked =
      providerStatus === 'configurationRequired' ||
      providerStatus === 'unavailable' ||
      providerStatus === 'comingSoon'
    const connectionBlocked =
      connection &&
      !['connected', 'degraded', 'actionRequired'].includes(connection.status)
    const providerSpecificBlock =
      isResendCapabilityBlocked({ capabilityId, connection }) ??
      isTwilioCapabilityBlocked({ capabilityId, connection })

    const available =
      supportedByProvider &&
      isConnected &&
      granted &&
      !providerBlocked &&
      !connectionBlocked &&
      !providerSpecificBlock

    return {
      id: capabilityId,
      label: labels[capabilityId] ?? capabilityId,
      supportedByProvider,
      granted,
      available,
      state: !supportedByProvider
        ? 'unsupported'
        : !granted
          ? 'notGranted'
          : available
            ? 'available'
            : 'blocked',
      blockedReason:
        providerSpecificBlock?.blockedReason ??
        (providerBlocked ? providerStatus : undefined) ??
        (connectionBlocked ? connection?.status : undefined),
      requiredAction:
        providerSpecificBlock?.requiredAction ??
        (providerBlocked ? availability?.safeMessage : undefined),
      source: connection ? 'workspaceConnection' : 'providerRegistry',
      lastValidatedAt: connection?.lastValidatedAt ?? null,
    }
  })
}
