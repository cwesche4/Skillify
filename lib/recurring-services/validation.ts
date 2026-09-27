import { z } from 'zod'

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value))

const currency = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), {
    message: 'Currency must be a three-letter ISO code.',
  })

const defaultJobPriority = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT'])

export const recurringServiceStepTemplateSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: optionalText(5_000),
  })
  .strict()

const mutableFields = {
  name: z.string().trim().min(1).max(300),
  description: optionalText(10_000),
  serviceInstructions: optionalText(10_000),
  pricePerVisitCents: z.number().int().min(0).max(2_147_483_647),
  currency,
  defaultJobPriority,
  defaultSteps: z.array(recurringServiceStepTemplateSchema).max(50),
}

export const createRecurringServiceSchema = z
  .object({
    customerId: z.string().trim().min(1).max(191),
    recurrenceSeriesId: z.string().trim().min(1).max(191),
    name: mutableFields.name,
    description: mutableFields.description,
    serviceInstructions: mutableFields.serviceInstructions,
    pricePerVisitCents: mutableFields.pricePerVisitCents,
    currency: mutableFields.currency.default('USD'),
    defaultJobPriority: mutableFields.defaultJobPriority.default('NORMAL'),
    defaultSteps: mutableFields.defaultSteps.default([]),
  })
  .strict()

export const updateRecurringServiceSchema = z
  .object(mutableFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one Recurring Service field to update.',
  })

export const recurringServiceLifecycleActionSchema = z.enum([
  'pause',
  'resume',
  'end',
])

export const recurringServiceLifecycleRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1).optional(),
    idempotencyKey: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
