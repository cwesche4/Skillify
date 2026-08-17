// Change control.
// Explicit policy gates only.
// No inference.

export type ChangeControlPolicies = {
  requirePublishApproval: boolean
  requireProdEditApproval: boolean
  requireSecretBindingApproval: boolean
  bulkEditApprovalThreshold?: number
}

const policyStore = new Map<string, ChangeControlPolicies>()

const defaultPolicies: ChangeControlPolicies = {
  requirePublishApproval: false,
  requireProdEditApproval: false,
  requireSecretBindingApproval: false,
  bulkEditApprovalThreshold: undefined,
}

export function getWorkspacePolicies(
  workspaceId: string,
): ChangeControlPolicies {
  return policyStore.get(workspaceId) ?? defaultPolicies
}

export function setWorkspacePolicies(
  workspaceId: string,
  policies: Partial<ChangeControlPolicies>,
) {
  const existing = policyStore.get(workspaceId) ?? defaultPolicies
  policyStore.set(workspaceId, { ...existing, ...policies })
}
