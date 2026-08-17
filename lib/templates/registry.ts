import { z } from 'zod'

export type TemplateCategory = 'AI' | 'Integrations' | 'Logic' | 'Organization'

// Canonical templates.
// Read-only reference only.
// Must be duplicated before modification or execution.
export interface AutomationTemplate {
  id: string
  slug?: string
  name?: string
  label: string
  category: TemplateCategory
  description: string
  version: string
  flow: any // read-only flow JSON
  explanation?: string // static AI-assisted explanation text
  requiredIntegrations?: string[]
  useCases?: string[]
  limitations?: string[]
}

export type TemplateMeta = AutomationTemplate & {
  name: string
  slug?: string
  tags?: string[]
}

const templateSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum(['AI', 'Integrations', 'Logic', 'Organization']),
  description: z.string(),
  version: z.string(),
  flow: z.any(),
  explanation: z.string().optional(),
})

export function validateTemplate(template: AutomationTemplate) {
  return templateSchema.safeParse(template)
}

export function listTemplates(): AutomationTemplate[] {
  return [
    {
      id: 'north-star-lead-intake',
      slug: 'north-star-lead-intake',
      name: 'North Star Lead Intake',
      label: 'North Star — Lead Intake (Read-only)',
      category: 'AI',
      description:
        'Canonical, read-only template demonstrating lead intake with approval pause.',
      version: '1.0.0',
      flow: {
        nodes: [],
        edges: [],
      },
      explanation:
        'Read-only reference template. Duplicate to edit or execute. No workspace data is bound.',
    },
  ]
}
