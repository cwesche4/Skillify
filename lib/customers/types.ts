export type CustomerRecord = {
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
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}

export type CreateCustomerData = Omit<
  CustomerRecord,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

export type UpdateCustomerData = Partial<
  Pick<
    CustomerRecord,
    | 'displayName'
    | 'companyName'
    | 'contactName'
    | 'email'
    | 'phone'
    | 'serviceAddressLine1'
    | 'serviceAddressLine2'
    | 'serviceAddressCity'
    | 'serviceAddressRegion'
    | 'serviceAddressPostalCode'
    | 'serviceAddressCountry'
    | 'notes'
    | 'assignedMemberId'
  >
>
