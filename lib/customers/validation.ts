import { z } from 'zod'

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value))

const optionalEmail = z
  .union([z.string().trim().max(320).email(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === '' ? null : value))

export const customerMutableFields = {
  displayName: z.string().trim().min(1).max(300),
  companyName: optionalText(300),
  contactName: optionalText(300),
  email: optionalEmail,
  phone: optionalText(50),
  serviceAddressLine1: optionalText(300),
  serviceAddressLine2: optionalText(300),
  serviceAddressCity: optionalText(120),
  serviceAddressRegion: optionalText(120),
  serviceAddressPostalCode: optionalText(32),
  serviceAddressCountry: optionalText(120),
  notes: optionalText(10_000),
  assignedMemberId: optionalText(191),
}

export const createCustomerSchema = z.object(customerMutableFields).strict()

export const updateCustomerSchema = z
  .object(customerMutableFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one Customer field to update.',
  })

export const customerListQuerySchema = z
  .object({ search: z.string().trim().max(200).optional() })
  .strict()
