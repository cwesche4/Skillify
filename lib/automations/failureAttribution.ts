// Lightweight classification of automation failures by source (string-only).
// This is metadata-only and does not change runtime behavior.
export type AutomationFailureSource =
  | 'trigger'
  | 'crm-trigger'
  | 'crm-action'
  | 'non-crm-action'
  | 'unknown'

export function classifyFailureSource(
  nodeType?: string,
): AutomationFailureSource {
  if (!nodeType) return 'unknown'
  const t = nodeType.toLowerCase()
  if (t === 'trigger') return 'trigger'
  if (t === 'crm-trigger') return 'crm-trigger'
  if (t === 'crm-action') return 'crm-action'
  if (t.includes('action')) return 'non-crm-action'
  return 'unknown'
}
