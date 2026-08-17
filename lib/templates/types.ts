// Template categories.
// UI-only affordance.
// Must not affect execution, permissions, or behavior.
import { z } from 'zod'
import type { TemplateCategory as UiTemplateCategory } from './categories'

export type TemplateCategory =
  | UiTemplateCategory
  | 'AI'
  | 'Integrations'
  | 'Logic'
  | 'Organization'

export type TemplateGraph = {
  nodes: any[]
  edges: any[]
  meta?: Record<string, any>
  guardrails?: {
    readOnly: true
    executable: false
    note?: string
  }
  version: number
}

export type AutomationTemplateSummary = {
  id: string
  slug: string
  name: string
  description?: string
  category?: TemplateCategory
  tags?: string[]
}

export type AutomationTemplate = {
  id: string
  slug?: string
  name?: string
  label: string
  category?: TemplateCategory
  description?: string
  version: string
  flow: any
  explanation?: string
  tags?: string[]
  requiredIntegrations?: string[]
  useCases?: string[]
  limitations?: string[]
}

export const TemplateSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  name: z.string().optional(),
  label: z.string(),
  category: z.any().optional(),
  description: z.string().optional(),
  version: z.string(),
  flow: z.any(),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional(),
  requiredIntegrations: z.array(z.string()).optional(),
  useCases: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
})
