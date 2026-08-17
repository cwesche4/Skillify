export const workspaceTeamTypes = [
  'general',
  'office',
  'fieldCrew',
  'sales',
  'service',
  'installation',
  'warehouse',
  'management',
  'other',
] as const

export type WorkspaceTeamTypeValue = (typeof workspaceTeamTypes)[number]

export const workspaceLocationTypes = [
  'office',
  'store',
  'warehouse',
  'shop',
  'serviceBase',
  'branch',
  'remote',
  'other',
] as const

export type WorkspaceLocationTypeValue = (typeof workspaceLocationTypes)[number]

export type WorkspaceTeamMemberSummary = {
  id: string
  workspaceMemberId: string
  roleLabel?: string | null
  isPrimary: boolean
  name: string
  email?: string | null
}

export type WorkspaceTeamSummary = {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  teamType?: WorkspaceTeamTypeValue | null
  leadMemberId?: string | null
  isActive: boolean
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
  members: WorkspaceTeamMemberSummary[]
}

export type WorkspaceLocationSummary = {
  id: string
  workspaceId: string
  name: string
  locationType: WorkspaceLocationTypeValue
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  countryCode?: string | null
  timezone?: string | null
  phone?: string | null
  notes?: string | null
  isPrimary: boolean
  isActive: boolean
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}
