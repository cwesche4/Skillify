import { z } from 'zod'

export const AIDecisionBranchSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().default(''),
})

export const AIDecisionSchema = z.object({
  label: z.string().trim().default('AI Decision'),
  branches: z
    .array(AIDecisionBranchSchema)
    .min(2, 'At least two branches required')
    .default([
      { key: 'option_a', label: 'Option A' },
      { key: 'option_b', label: 'Option B' },
    ]),
  confidenceThreshold: z.number().min(0).max(1).default(0.5),
  fallbackKey: z.string().trim().default('option_a'),
  note: z
    .string()
    .trim()
    .default('Deterministic AI decision across predefined branches.'),
})

export type AIDecisionData = z.infer<typeof AIDecisionSchema>
