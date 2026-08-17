import type { AutomationTemplate } from './types'

/**
 * Shallow clone of template data; caller is responsible for persistence.
 * No shared references to original template object.
 */
export function cloneTemplateData(template: AutomationTemplate) {
  return {
    label: template.label,
    description: template.description,
    flow: JSON.parse(JSON.stringify(template.flow ?? {})),
    sourceTemplateId: template.id,
  }
}
