import { z } from 'zod'

export const NATIVE_LEAD_CREATED_TOPIC = 'lead.created' as const
export const NATIVE_LEAD_FOLLOW_UP_DUE_TOPIC = 'lead.follow_up_due' as const
export const NATIVE_LEAD_AGGREGATE_TYPE = 'Lead' as const

export const nativeLeadCreatedPayloadSchema = z
  .object({
    source: z.literal('skillify-native'),
    workspaceId: z.string().min(1),
    leadId: z.string().min(1),
    displayName: z.string().min(1),
    companyName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    leadSource: z.string().nullable(),
    assignedMemberId: z.string().nullable(),
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict()

export type NativeLeadCreatedPayload = z.infer<
  typeof nativeLeadCreatedPayloadSchema
>

export const nativeLeadFollowUpDuePayloadSchema = z
  .object({
    source: z.literal('skillify-native'),
    workspaceId: z.string().min(1),
    leadId: z.string().min(1),
    scheduledFor: z.string().datetime({ offset: true }),
    scheduleRevision: z.string().uuid(),
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict()

export type NativeLeadFollowUpDuePayload = z.infer<
  typeof nativeLeadFollowUpDuePayloadSchema
>

export function createNativeLeadCreatedPayload(input: {
  workspaceId: string
  leadId: string
  displayName: string
  companyName: string | null
  email: string | null
  phone: string | null
  source: string | null
  assignedMemberId: string | null
  createdAt: Date
}): NativeLeadCreatedPayload {
  return {
    source: 'skillify-native',
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    displayName: input.displayName,
    companyName: input.companyName,
    email: input.email,
    phone: input.phone,
    leadSource: input.source,
    assignedMemberId: input.assignedMemberId,
    occurredAt: input.createdAt.toISOString(),
  }
}

export function nativeLeadEventKey(eventId: string) {
  return `native:domain-event:${eventId}`
}

export function createNativeLeadFollowUpDuePayload(input: {
  workspaceId: string
  leadId: string
  followUpAt: Date
  scheduleRevision: string
  occurredAt: Date
}): NativeLeadFollowUpDuePayload {
  return {
    source: 'skillify-native',
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    scheduledFor: input.followUpAt.toISOString(),
    scheduleRevision: input.scheduleRevision,
    occurredAt: input.occurredAt.toISOString(),
  }
}
