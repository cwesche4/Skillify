import { z } from 'zod'

export const RouterLabelSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().optional(),
  description: z.string().trim().default(''),
})

export const RouterNodeSchema = z.object({
  label: z.string().trim().default('AI Router'),
  allowedLabels: z
    .array(RouterLabelSchema)
    .min(1, 'At least one label required'),
  prompt: z.string().trim().default(''), // static prompt template, visible
})

export type RouterLabel = z.infer<typeof RouterLabelSchema>
export type RouterNodeConfig = z.infer<typeof RouterNodeSchema>

export type RouterOutcome = {
  matchedLabels: string[]
  explanation: string
}
