export const ENTITLEMENT_SCOPES = [
  'SECURITY_PACK',
  'EXPORTS',
  'APPROVALS',
  'ARTIFACT_DOWNLOAD',
] as const

export type EntitlementScope = (typeof ENTITLEMENT_SCOPES)[number]
