import {
  validateTransformOutput,
  type TransformField,
} from '@/lib/builder/validation/aiSchemas'

export type TransformInput = Record<string, any>

export type TransformResult = {
  ok: boolean
  errors: string[]
  parsed?: Record<string, any>
}

/**
 * Validate AI transform output against a required schema.
 * - No free-form output; fails fast on mismatch.
 */
export function runTransformValidation(params: {
  fields: TransformField[]
  output: any
}): TransformResult {
  return validateTransformOutput(params.fields, params.output)
}

/**
 * Preview: returns expected schema shape (keys + types).
 */
export function previewTransform(fields: TransformField[]) {
  return fields.map((f) => ({ key: f.key, type: f.type }))
}
