import { z } from 'zod'

const fieldTypes = ['string', 'number', 'boolean', 'object', 'array'] as const

export const TransformFieldSchema = z.object({
  key: z.string().trim().min(1, 'Field key required'),
  type: z.enum(fieldTypes),
})

export type TransformField = z.infer<typeof TransformFieldSchema>

export function validateTransformOutput(fields: TransformField[], output: any) {
  const errors: string[] = []
  const result: Record<string, any> = {}

  if (output === null || typeof output !== 'object' || Array.isArray(output)) {
    errors.push('Output must be an object.')
    return { ok: false, errors }
  }

  for (const field of fields) {
    const value = output[field.key]
    const actualType = Array.isArray(value) ? 'array' : typeof value
    if (value === undefined) {
      errors.push(`Missing field: ${field.key}`)
      continue
    }
    if (actualType !== field.type) {
      errors.push(
        `Field ${field.key} expected ${field.type} but got ${actualType}`,
      )
      continue
    }
    result[field.key] = value
  }

  return { ok: errors.length === 0, errors, parsed: result }
}
