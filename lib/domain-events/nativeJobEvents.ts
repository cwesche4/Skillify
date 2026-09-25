import { z } from 'zod'

export const NATIVE_JOB_COMPLETED_TOPIC = 'job.completed' as const
export const NATIVE_JOB_AGGREGATE_TYPE = 'Job' as const

export const nativeJobCompletedPayloadSchema = z
  .object({
    source: z.literal('skillify-native'),
    workspaceId: z.string().min(1),
    jobId: z.string().min(1),
    title: z.string().min(1),
    customerId: z.string().nullable(),
    customerDisplayName: z.string().nullable(),
    assignedMemberId: z.string().nullable(),
    completedAt: z.string().datetime({ offset: true }),
    completionRevision: z.string().uuid(),
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict()

export type NativeJobCompletedPayload = z.infer<
  typeof nativeJobCompletedPayloadSchema
>

export function createNativeJobCompletedPayload(input: {
  workspaceId: string
  jobId: string
  title: string
  customerId: string | null
  customerDisplayName: string | null
  assignedMemberId: string | null
  completedAt: Date
  completionRevision: string
  occurredAt: Date
}): NativeJobCompletedPayload {
  return {
    source: 'skillify-native',
    workspaceId: input.workspaceId,
    jobId: input.jobId,
    title: input.title,
    customerId: input.customerId,
    customerDisplayName: input.customerDisplayName,
    assignedMemberId: input.assignedMemberId,
    completedAt: input.completedAt.toISOString(),
    completionRevision: input.completionRevision,
    occurredAt: input.occurredAt.toISOString(),
  }
}

export function nativeJobEventKey(eventId: string) {
  return `native:domain-event:${eventId}`
}
