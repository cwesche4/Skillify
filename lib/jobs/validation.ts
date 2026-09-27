import { z } from 'zod'

import {
  JobStatus,
  JobUnableToCompleteReason,
  OperationsPriority,
  WorkItemKind,
  WorkItemStatus,
} from '@/lib/prisma/enums'

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional()

const optionalDate = z
  .union([
    z.date(),
    z.string().datetime({ offset: true }).pipe(z.coerce.date()),
  ])
  .nullable()
  .optional()

const nullableIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .nullable()
  .optional()

export const createJobSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: optionalText(10_000),
    notes: optionalText(10_000),
    status: z.nativeEnum(JobStatus).optional(),
    priority: z.nativeEnum(OperationsPriority).optional(),
    customerReferenceId: nullableIdentifier,
    customerId: nullableIdentifier,
    customerDisplayName: optionalText(300),
    valueCents: z
      .number()
      .int()
      .nonnegative()
      .max(2_147_483_647)
      .nullable()
      .optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .toUpperCase()
      .optional(),
    scheduledStartAt: optionalDate,
    scheduledEndAt: optionalDate,
    assigneeMemberId: nullableIdentifier,
  })
  .strict()

export const updateJobSchema = createJobSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one Job field to update.',
  })

export const jobListQuerySchema = z
  .object({ customerId: nullableIdentifier })
  .strict()

const workItemFields = {
  title: z.string().trim().min(1).max(200),
  description: optionalText(10_000),
  notes: optionalText(10_000),
  status: z.nativeEnum(WorkItemStatus).optional(),
  priority: z.nativeEnum(OperationsPriority).optional(),
  dueAt: optionalDate,
  assigneeMemberId: nullableIdentifier,
}

export const createWorkItemSchema = z
  .object({
    ...workItemFields,
    kind: z.nativeEnum(WorkItemKind),
    jobId: nullableIdentifier,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === WorkItemKind.JOB_STEP && !value.jobId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jobId'],
        message: 'A Job Step must belong to a Job.',
      })
    }
    if (value.kind === WorkItemKind.TODO && value.jobId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jobId'],
        message: 'A To-Do cannot belong to a Job.',
      })
    }
  })

export const createJobStepSchema = z.object(workItemFields).strict()

export const createTodoSchema = z.object(workItemFields).strict()

export const updateWorkItemSchema = z
  .object(workItemFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one Work Item field to update.',
  })

export const executeAssignedWorkItemSchema = z
  .object({
    status: z.nativeEnum(WorkItemStatus).optional(),
    notes: optionalText(10_000),
  })
  .strict()

export const executeAssignedJobSchema = z
  .object({
    status: z.enum(['IN_PROGRESS', 'COMPLETED']).optional(),
    notes: optionalText(10_000),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide a status or notes update.',
  })

export const reportUnableToCompleteSchema = z
  .object({
    reason: z.nativeEnum(JobUnableToCompleteReason),
    note: optionalText(2_000),
  })
  .strict()

export const skipRecurringJobSchema = z
  .object({
    reason: z.enum([
      'CUSTOMER_REQUEST',
      'WEATHER',
      'ACCESS_ISSUE',
      'STAFFING',
      'EQUIPMENT',
      'HOLIDAY',
      'OTHER',
    ]),
    note: optionalText(2_000),
    expectedVersion: z.number().int().min(1).optional(),
    idempotencyKey: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

export const rescheduleUnableRecurringJobSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    expectedVersion: z.number().int().min(1).optional(),
    idempotencyKey: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine(
    (value) =>
      new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(),
    {
      message: 'Scheduled end must be after scheduled start.',
      path: ['endsAt'],
    },
  )

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>
export type ExecuteAssignedWorkItemInput = z.infer<
  typeof executeAssignedWorkItemSchema
>
export type ExecuteAssignedJobInput = z.infer<typeof executeAssignedJobSchema>
