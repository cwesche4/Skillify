import { z } from 'zod'

export const TransformFieldSchema = z.object({
  key: z.string().trim().min(1, 'Field key required'),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
})

export const TransformNodeSchema = z.object({
  label: z.string().trim().default('AI Transform'),
  inputSchema: z.record(z.any()).default({}), // descriptive only
  outputSchema: z
    .array(TransformFieldSchema)
    .min(1, 'At least one field required'),
  note: z
    .string()
    .trim()
    .default(
      'Transforms structured input to schema-bound output; fails on mismatch.',
    ),
})

export type TransformField = z.infer<typeof TransformFieldSchema>
export type TransformNodeConfig = z.infer<typeof TransformNodeSchema>
