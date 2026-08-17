import type { TransformField, TransformNodeConfig } from './types'
import { validateTransformOutput } from '@/lib/builder/validation/aiSchemas'

export type TransformInput = Record<string, any>

export type TransformOutcome = {
  ok: boolean
  errors: string[]
  parsed?: Record<string, any>
}

/**
 * Validate AI transform output against explicit schema.
 * - No branching or execution control.
 * - Fails closed on mismatch.
 */
export function evaluateTransform(params: {
  config: TransformNodeConfig
  output: any
}): TransformOutcome {
  const fields: TransformField[] = params.config.outputSchema
  const result = validateTransformOutput(fields, params.output)
  return {
    ok: result.ok,
    errors: result.errors,
    parsed: result.parsed,
  }
}
