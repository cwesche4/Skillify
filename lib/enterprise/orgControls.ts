// Enterprise org-level controls.
// Read-only aggregation only. No cross-workspace execution or shared secrets.

type OrgRecord = {
  id: string
  name: string
  workspaceIds: string[]
}

const orgStore = new Map<string, OrgRecord>()

export function registerOrg(org: OrgRecord) {
  orgStore.set(org.id, org)
}

export function listOrgWorkspaces(orgId: string): string[] {
  return orgStore.get(orgId)?.workspaceIds ?? []
}

export function getOrg(orgId: string): OrgRecord | undefined {
  return orgStore.get(orgId)
}
