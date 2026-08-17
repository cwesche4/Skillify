import type { AutomationTemplate } from './types'

export function cloneTemplate(template: AutomationTemplate, newId: string) {
  return {
    ...template,
    id: newId,
  }
}

/**
 * Templates are immutable once published; version bumps must create a new template.
 */
export function bumpTemplateVersion(
  template: AutomationTemplate,
  newVersion: string,
  newId: string,
) {
  return {
    ...template,
    id: newId,
    version: newVersion,
  }
}
