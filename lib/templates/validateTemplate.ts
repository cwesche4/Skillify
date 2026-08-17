import type { AutomationTemplate } from './types'

const credentialKeys = ['token', 'apiKey', 'secret', 'password']

/**
 * Basic guardrail validation for templates.
 * - No credentials embedded
 * - No auto-enabled webhooks
 * - No bypass flags for approvals/entitlements
 */
export function validateTemplateGuardrails(template: AutomationTemplate) {
  const issues: string[] = []

  const flow = template.flow ?? {}

  // Credential-like fields
  JSON.stringify(flow)
    .toLowerCase()
    .split(/[^a-z0-9]/)
    .forEach((word) => {
      if (credentialKeys.includes(word)) {
        issues.push('Template appears to contain credential-like fields.')
      }
    })

  // Webhooks: ensure not auto-enabled without user config (best-effort structural check)
  if (Array.isArray(flow.nodes)) {
    for (const node of flow.nodes) {
      if (node.type === 'webhook' && node.data?.url) {
        // placeholder check; real enforcement is server-side when saving/executing
        issues.push(
          'Template includes webhook URL; ensure user review before execution.',
        )
      }
      if (node.type === 'approval' && node.data?.autoApprove) {
        issues.push('Template attempts to auto-approve; not allowed.')
      }
    }
  }

  return { ok: issues.length === 0, issues }
}
