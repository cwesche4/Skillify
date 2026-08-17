import { resolveEmailDeliveryProvider } from '@/lib/integrations/emailDeliveryPolicy'
import { resolveIntegrationCapabilities } from '@/lib/integrations/capabilities'
import { resolveIntegrationHealth } from '@/lib/integrations/health'
import {
  getIntegrationProviderDefinition,
  listIntegrationProviderAvailability,
} from '@/lib/integrations/providerRegistry'
import type { SafeWorkspaceIntegrationConnection } from '@/lib/integrations/workspaceConnections'

export type NotificationChannel = 'inApp' | 'email' | 'sms' | 'slack'

export type NotificationChannelAvailability = {
  channel: NotificationChannel
  available: boolean
  enabled: boolean
  selectedProvider: string | null
  blockedReason?: string
  requiredAction?: string
}

export function resolveNotificationChannelAvailability({
  channel,
  enabled,
  workspaceConnections,
  platformEmailAvailable,
}: {
  channel: NotificationChannel
  enabled: boolean
  workspaceConnections: SafeWorkspaceIntegrationConnection[]
  platformEmailAvailable: boolean
}): NotificationChannelAvailability {
  if (channel === 'inApp') {
    return { channel, available: true, enabled, selectedProvider: 'skillify' }
  }

  if (channel === 'email') {
    const email = resolveEmailDeliveryProvider({
      purpose: 'schedulingReminder',
      workspaceConnections,
      platformEmailAvailable,
    })
    return {
      channel,
      available: email.provider === 'workspaceResend',
      enabled,
      selectedProvider:
        email.provider === 'workspaceResend' ? email.connectionId : null,
      blockedReason: email.provider === 'disabled' ? email.reason : undefined,
      requiredAction:
        email.provider === 'disabled'
          ? 'Connect and verify a workspace Resend sender.'
          : undefined,
    }
  }

  if (channel === 'sms') {
    const provider = getIntegrationProviderDefinition('twilio')
    const availability = listIntegrationProviderAvailability({}).find(
      (item) => item.providerId === 'twilio',
    )
    const connection =
      workspaceConnections.find(
        (item) => item.providerId === 'twilio' && item.status === 'connected',
      ) ?? null
    const capabilities =
      provider && availability
        ? resolveIntegrationCapabilities({
            provider,
            availability,
            connection,
          })
        : []
    const sms = capabilities.find((item) => item.id === 'sms.send')
    return {
      channel,
      available: Boolean(sms?.available),
      enabled,
      selectedProvider: connection?.id ?? null,
      blockedReason: sms?.blockedReason ?? 'twilioNotConnected',
      requiredAction:
        sms?.requiredAction ?? 'Connect a customer-owned Twilio account.',
    }
  }

  const slack = workspaceConnections.find(
    (item) => item.providerId === 'slack' && item.status === 'connected',
  )
  const health = slack
    ? resolveIntegrationHealth({ providerId: 'slack', connection: slack })
    : null
  return {
    channel,
    available: Boolean(slack && health?.state === 'healthy'),
    enabled,
    selectedProvider: slack?.id ?? null,
    blockedReason: slack ? health?.state : 'slackNotConnected',
    requiredAction: 'Connect Slack when this provider becomes available.',
  }
}
