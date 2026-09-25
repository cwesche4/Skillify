export function normalizeLeadDuplicateEmail(value: string | null) {
  return value?.trim().toLowerCase() || null
}

export function normalizeLeadDuplicatePhone(value: string | null) {
  const digits = value?.replace(/\D/g, '') ?? ''
  return digits || null
}

export function customerDisplayNameFromLead(input: {
  displayName: string
  companyName: string | null
}) {
  return input.companyName ?? input.displayName
}
