import { Resend } from 'resend'

import { EstimateExperienceError } from '@/lib/estimates/customerExperienceError'
import { resolveEmailDeliveryProvider } from '@/lib/integrations/emailDeliveryPolicy'
import {
  listWorkspaceIntegrationConnections,
  readWorkspaceConnectionCredentials,
} from '@/lib/integrations/workspaceConnections'

export type VerifiedEstimateSender = {
  connectionId: string
  apiKey: string
  from: string
  replyTo?: string
}

export type EstimateEmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}

export type EstimateEmailResult =
  | {
      status: 'sent'
      provider: 'resend'
      providerMessageId?: string
    }
  | {
      status: 'failed'
      provider: 'resend'
      code: string
      message: string
      retryable: boolean
    }

function cleanHeader(value: string | undefined) {
  return value?.replace(/[\r\n]/g, ' ').trim() || undefined
}

export async function resolveVerifiedEstimateSender(
  workspaceId: string,
): Promise<VerifiedEstimateSender> {
  const connections = await listWorkspaceIntegrationConnections({ workspaceId })
  const resolution = resolveEmailDeliveryProvider({
    purpose: 'quote',
    workspaceConnections: connections,
    platformEmailAvailable: false,
  })
  if (resolution.provider !== 'workspaceResend') {
    throw new EstimateExperienceError(
      resolution.reason === 'workspaceSenderUnverified'
        ? 'Verify the workspace Resend sending domain before sending an Estimate.'
        : 'Connect a verified workspace Resend sender before sending an Estimate.',
      409,
      'UNAVAILABLE',
    )
  }
  const credentials = await readWorkspaceConnectionCredentials({
    workspaceId,
    connectionId: resolution.connectionId,
  })
  const apiKey = credentials?.apiKey
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new EstimateExperienceError(
      'The workspace Resend credentials are unavailable. Reconnect the sender.',
      409,
      'UNAVAILABLE',
    )
  }
  const fromName = cleanHeader(resolution.fromName)
  const fromEmail = cleanHeader(resolution.fromEmail)!
  return {
    connectionId: resolution.connectionId,
    apiKey,
    from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
    replyTo: cleanHeader(resolution.replyTo),
  }
}

export async function sendEstimateEmailWithResend({
  sender,
  message,
}: {
  sender: VerifiedEstimateSender
  message: EstimateEmailMessage
}): Promise<EstimateEmailResult> {
  try {
    const response = await new Resend(sender.apiKey).emails.send({
      from: sender.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: sender.replyTo,
      headers: { 'Idempotency-Key': message.idempotencyKey },
    })
    if (response.error) {
      const statusCode = response.error.statusCode ?? 500
      return {
        status: 'failed',
        provider: 'resend',
        code: `RESEND_${statusCode}`,
        message:
          statusCode === 429 || statusCode >= 500
            ? 'The Estimate email provider is temporarily unavailable.'
            : 'The Estimate email provider rejected the message.',
        retryable: statusCode === 429 || statusCode >= 500,
      }
    }
    return {
      status: 'sent',
      provider: 'resend',
      providerMessageId: response.data?.id,
    }
  } catch {
    return {
      status: 'failed',
      provider: 'resend',
      code: 'RESEND_NETWORK_ERROR',
      message: 'The Estimate email provider request failed.',
      retryable: true,
    }
  }
}
