import type { JobRecord } from '@/lib/jobs/types'

export type CustomerOperationalContext = {
  id: string
  displayName: string
  contactName: string | null
  email: string | null
  phone: string | null
  serviceAddressLine1: string | null
  serviceAddressLine2: string | null
  serviceAddressCity: string | null
  serviceAddressRegion: string | null
  serviceAddressPostalCode: string | null
  serviceAddressCountry: string | null
}

export function formatCustomerServiceLocation(
  customer: CustomerOperationalContext,
) {
  const regionAndPostal = [
    customer.serviceAddressRegion,
    customer.serviceAddressPostalCode,
  ]
    .filter(Boolean)
    .join(' ')
  const locality = [customer.serviceAddressCity, regionAndPostal || null]
    .filter(Boolean)
    .join(', ')
  return (
    [
      customer.serviceAddressLine1,
      customer.serviceAddressLine2,
      locality || null,
      customer.serviceAddressCountry,
    ]
      .filter(Boolean)
      .join('\n') || null
  )
}

export function customerOperationalSnapshots(
  customer: CustomerOperationalContext,
) {
  return {
    customerDisplayName: customer.displayName,
    serviceLocationSnapshot: formatCustomerServiceLocation(customer),
    customerContactNameSnapshot: customer.contactName,
    customerPhoneSnapshot: customer.phone,
    customerEmailSnapshot: customer.email,
  }
}

export function presentJobOperationalContext(
  job: JobRecord,
  mayViewOperationalContext: boolean,
  mayViewExceptionContext = mayViewOperationalContext,
) {
  if (mayViewOperationalContext && mayViewExceptionContext) return job

  return {
    ...job,
    ...(mayViewOperationalContext
      ? {}
      : {
          customerReferenceId: null,
          customerId: null,
          customerDisplayName: null,
          serviceLocationSnapshot: null,
          customerContactNameSnapshot: null,
          customerPhoneSnapshot: null,
          customerEmailSnapshot: null,
        }),
    ...(mayViewExceptionContext
      ? {}
      : {
          unableToCompleteReason: null,
          unableToCompleteNote: null,
          unableToCompleteAt: null,
          unableToCompleteReportedByMemberId: null,
        }),
  }
}
