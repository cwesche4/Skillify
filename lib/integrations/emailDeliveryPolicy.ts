import type { SafeWorkspaceIntegrationConnection } from '@/lib/integrations/workspaceConnections'

export type OutboundEmailPurpose =
  | 'workspaceInvitation'
  | 'authentication'
  | 'security'
  | 'billing'
  | 'platformAlert'
  | 'schedulingReminder'
  | 'customerFollowUp'
  | 'quote'
  | 'serviceUpdate'
  | 'invoice'
  | 'reviewRequest'

export type EmailDeliveryResolution =
  | {
      provider: 'platformEmail'
      reason: 'platformMessage'
    }
  | {
      provider: 'workspaceResend'
      connectionId: string
      fromEmail: string
      fromName?: string
      replyTo?: string
      reason: 'workspaceBusinessMessage'
    }
  | {
      provider: 'disabled'
      reason:
        | 'workspaceSenderUnavailable'
        | 'workspaceSenderUnverified'
        | 'platformEmailUnavailable'
    }

const platformPurposes = new Set<OutboundEmailPurpose>([
  'workspaceInvitation',
  'authentication',
  'security',
  'billing',
  'platformAlert',
])

function metadataValue(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function resolveEmailDeliveryProvider({
  purpose,
  workspaceConnections,
  platformEmailAvailable,
}: {
  purpose: OutboundEmailPurpose
  workspaceConnections: SafeWorkspaceIntegrationConnection[]
  platformEmailAvailable: boolean
}): EmailDeliveryResolution {
  if (platformPurposes.has(purpose)) {
    return platformEmailAvailable
      ? { provider: 'platformEmail', reason: 'platformMessage' }
      : { provider: 'disabled', reason: 'platformEmailUnavailable' }
  }

  const resend = workspaceConnections.find(
    (connection) =>
      connection.providerId === 'resend' &&
      connection.status === 'connected' &&
      !connection.revokedAt &&
      !connection.disabledAt,
  )
  if (!resend) {
    return { provider: 'disabled', reason: 'workspaceSenderUnavailable' }
  }

  const domainStatus = metadataValue(resend.providerMetadata, 'domainStatus')
  if (domainStatus !== 'verified') {
    return { provider: 'disabled', reason: 'workspaceSenderUnverified' }
  }

  const fromEmail = metadataValue(resend.providerMetadata, 'fromEmail')
  if (!fromEmail) {
    return { provider: 'disabled', reason: 'workspaceSenderUnavailable' }
  }

  return {
    provider: 'workspaceResend',
    connectionId: resend.id,
    fromEmail,
    fromName: metadataValue(resend.providerMetadata, 'fromName'),
    replyTo: metadataValue(resend.providerMetadata, 'replyTo'),
    reason: 'workspaceBusinessMessage',
  }
}
