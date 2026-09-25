import { z } from 'zod'

import { LeadStage } from '@/lib/prisma/enums'

export const leadSources = [
  'Website Form',
  'Referral',
  'Google Search',
  'Facebook/Instagram',
  'Manual Entry',
] as const

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value))

const optionalEmail = z
  .union([z.string().trim().max(320).email(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === '' ? null : value))

const optionalDate = z
  .union([
    z.date(),
    z.string().datetime({ offset: true }).pipe(z.coerce.date()),
  ])
  .nullable()
  .optional()

const optionalValue = z
  .number()
  .int()
  .nonnegative()
  .max(2_147_483_647)
  .nullable()
  .optional()

const leadMutableFields = {
  displayName: z.string().trim().min(1).max(300),
  companyName: optionalText(300),
  email: optionalEmail,
  phone: optionalText(50),
  stage: z.nativeEnum(LeadStage).optional(),
  source: z.enum(leadSources).nullable().optional(),
  estimatedValueCents: optionalValue,
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .toUpperCase()
    .optional(),
  nextStep: optionalText(500),
  followUpAt: optionalDate,
  assignedMemberId: optionalText(191),
  notes: optionalText(10_000),
}

export const createLeadSchema = z.object(leadMutableFields).strict()

export const updateLeadSchema = z
  .object(leadMutableFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one Lead field to update.',
  })

export const leadListQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    stage: z.nativeEnum(LeadStage).optional(),
  })
  .strict()

export const convertLeadSchema = z
  .object({
    confirmDuplicate: z.boolean().optional().default(false),
  })
  .strict()
