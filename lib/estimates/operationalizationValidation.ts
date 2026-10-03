import { z } from 'zod'

import { OperationsPriority } from '@/lib/prisma/enums'

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional()

const assignmentSchema = z.discriminatedUnion('assignmentType', [
  z
    .object({
      assignmentType: z.literal('MEMBER'),
      workspaceMemberId: z.string().trim().min(1).max(191),
      roleLabel: optionalText(120),
    })
    .strict(),
  z
    .object({
      assignmentType: z.literal('TEAM'),
      teamId: z.string().trim().min(1).max(191),
      roleLabel: optionalText(120),
    })
    .strict(),
])

const assignmentsArray = z.array(assignmentSchema).max(50)

function rejectDuplicateAssignments(
  assignments: z.infer<typeof assignmentSchema>[],
  context: z.RefinementCtx,
) {
  const seen = new Set<string>()
  assignments.forEach((assignment, index) => {
    const key =
      assignment.assignmentType === 'MEMBER'
        ? `MEMBER:${assignment.workspaceMemberId}`
        : `TEAM:${assignment.teamId}`
    if (seen.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index],
        message: 'Each member or team can be assigned only once.',
      })
    }
    seen.add(key)
  })
}

const assignmentsSchema = assignmentsArray.superRefine(
  rejectDuplicateAssignments,
)

const recurrenceRuleSchema = z
  .object({
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number().int().min(1).max(365),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    endType: z.enum(['never', 'onDate', 'afterOccurrences']),
    endDate: z.string().trim().optional(),
    occurrenceCount: z.number().int().min(1).max(10_000).optional(),
  })
  .strict()

const recurringScheduleSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    timezone: z.string().trim().min(1).max(100),
    recurrenceRule: recurrenceRuleSchema,
    locationType: z.enum([
      'customerLocation',
      'physicalAddress',
      'toBeDetermined',
    ]),
    locationLabel: optionalText(300),
    locationAddress: optionalText(2_000),
    assignments: assignmentsArray
      .min(1, 'Assign at least one member or team.')
      .superRefine(rejectDuplicateAssignments),
  })
  .strict()
  .refine(
    (value) =>
      new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(),
    {
      path: ['endsAt'],
      message: 'End time must be after start time.',
    },
  )
  .refine(
    (value) =>
      value.locationType !== 'physicalAddress' ||
      Boolean(value.locationAddress?.trim()),
    {
      path: ['locationAddress'],
      message: 'Enter the service address.',
    },
  )

const lineId = z.string().trim().min(1).max(191)
const maxRecurringLinesPerHandoff = 50

export const estimateOperationalizationSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    idempotencyKey: z.string().uuid(),
    oneTime: z
      .object({
        title: z.string().trim().min(1).max(200).optional(),
        notes: optionalText(10_000),
        priority: z.nativeEnum(OperationsPriority),
        scheduledStartAt: z.string().datetime({ offset: true }).optional(),
        scheduledEndAt: z.string().datetime({ offset: true }).optional(),
        assignments: assignmentsSchema,
        lineItems: z
          .array(
            z
              .object({
                estimateLineItemId: lineId,
                createJobStep: z.boolean(),
                stepTitle: z.string().trim().min(1).max(200).optional(),
                stepDescription: optionalText(10_000),
              })
              .strict(),
          )
          .max(1_000),
      })
      .strict()
      .superRefine((value, context) => {
        const scheduled = Boolean(
          value.scheduledStartAt || value.scheduledEndAt,
        )
        if (scheduled && !(value.scheduledStartAt && value.scheduledEndAt)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['scheduledStartAt'],
            message: 'Provide both scheduled start and end times.',
          })
        }
        if (
          value.scheduledStartAt &&
          value.scheduledEndAt &&
          new Date(value.scheduledEndAt).getTime() <=
            new Date(value.scheduledStartAt).getTime()
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['scheduledEndAt'],
            message: 'Scheduled end must be after scheduled start.',
          })
        }
        if (scheduled && value.assignments.length === 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['assignments'],
            message: 'Scheduled one-time work requires an assignment.',
          })
        }
      })
      .optional(),
    recurring: z
      .array(
        z
          .object({
            estimateLineItemId: lineId,
            serviceInstructions: optionalText(10_000),
            priority: z.nativeEnum(OperationsPriority),
            stepTemplates: z
              .array(
                z
                  .object({
                    title: z.string().trim().min(1).max(200),
                    description: optionalText(10_000),
                  })
                  .strict(),
              )
              .max(200),
            schedule: recurringScheduleSchema,
          })
          .strict(),
      )
      .max(
        maxRecurringLinesPerHandoff,
        `Create no more than ${maxRecurringLinesPerHandoff} recurring services in one handoff.`,
      ),
  })
  .strict()

export type EstimateOperationalizationInput = z.output<
  typeof estimateOperationalizationSchema
>
