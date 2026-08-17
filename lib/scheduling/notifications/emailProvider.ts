import { Resend } from 'resend'

export type SchedulingEmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  idempotencyKey: string
  metadata?: Record<string, string>
}

export type SchedulingEmailSendResult =
  | {
      status: 'sent'
      provider: string
      providerMessageId?: string
    }
  | {
      status: 'skipped'
      provider: string
      code: string
      message: string
      permanent: true
    }
  | {
      status: 'failed'
      provider: string
      code: string
      message: string
      retryable: boolean
    }

export interface SchedulingEmailProvider {
  send(input: SchedulingEmailMessage): Promise<SchedulingEmailSendResult>
}

const sentDevelopmentMessages: SchedulingEmailMessage[] = []

export function getDevelopmentSchedulingEmailMessages() {
  return [...sentDevelopmentMessages]
}

export function clearDevelopmentSchedulingEmailMessages() {
  sentDevelopmentMessages.length = 0
}

export class DevelopmentSchedulingEmailProvider implements SchedulingEmailProvider {
  async send(
    input: SchedulingEmailMessage,
  ): Promise<SchedulingEmailSendResult> {
    if (process.env.SCHEDULING_EMAIL_DEV_MODE === 'transient-failure') {
      return {
        status: 'failed',
        provider: 'development',
        code: 'DEV_TRANSIENT_FAILURE',
        message: 'Development email adapter simulated a transient failure.',
        retryable: true,
      }
    }
    if (process.env.SCHEDULING_EMAIL_DEV_MODE === 'permanent-failure') {
      return {
        status: 'failed',
        provider: 'development',
        code: 'DEV_PERMANENT_FAILURE',
        message: 'Development email adapter simulated a permanent failure.',
        retryable: false,
      }
    }
    sentDevelopmentMessages.push(input)
    return {
      status: 'sent',
      provider: 'development',
      providerMessageId: `dev-${input.idempotencyKey}`,
    }
  }
}

export class DisabledSchedulingEmailProvider implements SchedulingEmailProvider {
  async send(): Promise<SchedulingEmailSendResult> {
    return {
      status: 'skipped',
      provider: 'disabled',
      code: 'EMAIL_PROVIDER_DISABLED',
      message: 'Scheduling email delivery is not configured.',
      permanent: true,
    }
  }
}

export class ResendSchedulingEmailProvider implements SchedulingEmailProvider {
  private readonly client: Resend
  private readonly from: string
  private readonly replyTo?: string

  constructor({
    apiKey,
    from,
    replyTo,
  }: {
    apiKey: string
    from: string
    replyTo?: string
  }) {
    this.client = new Resend(apiKey)
    this.from = from
    this.replyTo = replyTo
  }

  async send(
    input: SchedulingEmailMessage,
  ): Promise<SchedulingEmailSendResult> {
    try {
      const response = await this.client.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo ?? this.replyTo,
        headers: {
          'Idempotency-Key': input.idempotencyKey,
        },
      })
      if (response.error) {
        const statusCode = response.error.statusCode ?? 500
        return {
          status: 'failed',
          provider: 'resend',
          code: `RESEND_${statusCode}`,
          message:
            statusCode >= 500 || statusCode === 429
              ? 'Scheduling email provider is temporarily unavailable.'
              : 'Scheduling email could not be delivered.',
          retryable: statusCode >= 500 || statusCode === 429,
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
        message: 'Scheduling email provider request failed.',
        retryable: true,
      }
    }
  }
}

export function getSchedulingEmailProvider(): SchedulingEmailProvider {
  if (process.env.NODE_ENV === 'test') {
    return new DevelopmentSchedulingEmailProvider()
  }
  if (process.env.SCHEDULING_EMAIL_DEV_MODE) {
    return new DevelopmentSchedulingEmailProvider()
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return new DisabledSchedulingEmailProvider()
  return new ResendSchedulingEmailProvider({
    apiKey,
    from:
      process.env.SCHEDULING_EMAIL_FROM ||
      process.env.EMAIL_FROM ||
      'Skillify <no-reply@skillify.tech>',
    replyTo: process.env.SCHEDULING_EMAIL_REPLY_TO,
  })
}

export function isValidEmailAddress(value: string | null | undefined) {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
