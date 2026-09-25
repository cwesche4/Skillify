export type CustomerClientRecord = {
  id: string
  workspaceId: string
  displayName: string
  companyName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  serviceAddressLine1: string | null
  serviceAddressLine2: string | null
  serviceAddressCity: string | null
  serviceAddressRegion: string | null
  serviceAddressPostalCode: string | null
  serviceAddressCountry: string | null
  notes: string | null
  assignedMemberId: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type CustomerMutationInput = {
  displayName?: string
  companyName?: string | null
  contactName?: string | null
  email?: string | null
  phone?: string | null
  serviceAddressLine1?: string | null
  serviceAddressLine2?: string | null
  serviceAddressCity?: string | null
  serviceAddressRegion?: string | null
  serviceAddressPostalCode?: string | null
  serviceAddressCountry?: string | null
  notes?: string | null
  assignedMemberId?: string | null
}

export type CustomerMemberOption = {
  id: string
  name: string
  role: string
}
