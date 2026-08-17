import { TemplateSchema, type AutomationTemplate } from './types'

/**
 * Validate a template against the canonical schema.
 * - Templates must be read-only; enforcement happens at usage time (clone required).
 */
export function validateTemplate(template: AutomationTemplate) {
  return TemplateSchema.safeParse(template)
}

/**
 * Authoring constraints (checks only, no mutations).
 */
export function enforceAuthoringConstraints(template: AutomationTemplate) {
  const issues: string[] = []
  const parsed = validateTemplate(template)
  if (!parsed.success) {
    issues.push(...parsed.error.errors.map((e) => e.message))
  }
  if (!template.flow) {
    issues.push('Template must include flow JSON.')
  }
  return { ok: issues.length === 0, issues }
}
