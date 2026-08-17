import { z } from 'zod'

export const DecisionCategorySchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().default(''),
  description: z.string().trim().default(''),
})

export const DecisionNodeSchema = z.object({
  label: z.string().trim().default('AI Decision'),
  categories: z
    .array(DecisionCategorySchema)
    .min(2, 'At least two categories required'),
  prompt: z.string().trim().default(''), // static, visible prompt template
  inputSchema: z.record(z.string(), z.any()).default({}), // descriptive only
})

export type DecisionCategory = z.infer<typeof DecisionCategorySchema>
export type DecisionNodeConfig = z.infer<typeof DecisionNodeSchema>

export type DecisionOutcome = {
  category: string
  confidence: number
  explanation: string
  inputSummary: string
}
