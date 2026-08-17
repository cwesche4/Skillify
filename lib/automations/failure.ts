export type AutomationFailureSource =
  | 'trigger'
  | 'crm-trigger'
  | 'crm-action'
  | 'action'
  | 'unknown'

export function classifyAutomationFailureSource(
  nodeType?: string,
): AutomationFailureSource {
  if (!nodeType) return 'unknown'
  const t = nodeType.toLowerCase()
  if (t === 'trigger') return 'trigger'
  if (t === 'crm-trigger') return 'crm-trigger'
  if (t === 'crm-action') return 'crm-action'
  if (t.includes('action')) return 'action'
  return 'unknown'
}
