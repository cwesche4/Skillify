import { z } from 'zod'

import { isSchedulingDateKey } from '@/lib/scheduling/schedulingDateTime'

export const MAX_ESTIMATE_AMOUNT_CENTS = 100_000_000
export const MAX_ESTIMATE_LINE_ITEMS = 100

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value))

const optionalEmail = z
  .union([z.string().trim().max(320).email(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === '' ? null : value))

const optionalId = z
  .union([z.string().trim().min(1).max(191), z.null()])
  .optional()

const currency = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), {
    message: 'Currency must be a three-letter ISO code.',
  })

const expiry = z
  .union([
    z.string().trim().refine(isSchedulingDateKey, {
      message: 'Expiry must be a valid calendar date.',
    }),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((value) => (value === '' ? null : value))

export const estimateLineItemSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: optionalText(5_000),
    billingBasis: z.enum(['ONE_TIME', 'PER_VISIT']),
    amountCents: z.number().int().min(0).max(MAX_ESTIMATE_AMOUNT_CENTS),
  })
  .strict()

const commercialFields = {
  title: z.string().trim().min(1).max(300),
  scopeDescription: optionalText(10_000),
  contactNameSnapshot: optionalText(300),
  contactEmailSnapshot: optionalEmail,
  contactPhoneSnapshot: optionalText(50),
  serviceAddressLine1Snapshot: optionalText(300),
  serviceAddressLine2Snapshot: optionalText(300),
  serviceAddressCitySnapshot: optionalText(120),
  serviceAddressRegionSnapshot: optionalText(120),
  serviceAddressPostalCodeSnapshot: optionalText(32),
  serviceAddressCountrySnapshot: optionalText(120),
  currency,
  expiresOn: expiry,
  lineItems: z.array(estimateLineItemSchema).max(MAX_ESTIMATE_LINE_ITEMS),
}

export const createEstimateSchema = z
  .object({
    leadId: optionalId,
    customerId: optionalId,
    title: commercialFields.title,
    scopeDescription: commercialFields.scopeDescription,
    currency: commercialFields.currency.default('USD'),
    expiresOn: commercialFields.expiresOn,
    lineItems: commercialFields.lineItems.default([]),
  })
  .strict()
  .refine((value) => Boolean(value.leadId || value.customerId), {
    message: 'Choose a Lead or Customer.',
    path: ['leadId'],
  })

export const updateEstimateSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    ...commercialFields,
  })
  .partial({
    title: true,
    scopeDescription: true,
    contactNameSnapshot: true,
    contactEmailSnapshot: true,
    contactPhoneSnapshot: true,
    serviceAddressLine1Snapshot: true,
    serviceAddressLine2Snapshot: true,
    serviceAddressCitySnapshot: true,
    serviceAddressRegionSnapshot: true,
    serviceAddressPostalCodeSnapshot: true,
    serviceAddressCountrySnapshot: true,
    currency: true,
    expiresOn: true,
    lineItems: true,
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'expectedVersion'),
    {
      message: 'Provide at least one Estimate field to update.',
    },
  )

export const estimateLifecycleSchema = z
  .object({ expectedVersion: z.number().int().min(1) })
  .strict()

export const estimateListQuerySchema = z
  .object({
    view: z
      .enum([
        'ALL',
        'DRAFT',
        'PRESENTED',
        'PAST_EXPIRY',
        'ACCEPTED',
        'DECLINED',
        'VOIDED',
        'ARCHIVED',
      ])
      .default('ALL'),
    cursor: z.string().trim().min(1).max(191).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    leadId: z.string().trim().min(1).max(191).optional(),
    customerId: z.string().trim().min(1).max(191).optional(),
  })
  .strict()
