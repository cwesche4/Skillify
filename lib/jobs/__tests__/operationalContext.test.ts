import { describe, expect, it } from 'vitest'

import {
  customerOperationalSnapshots,
  presentJobOperationalContext,
} from '@/lib/jobs/operationalContext'
import type { JobRecord } from '@/lib/jobs/types'

describe('Job-scoped operational context', () => {
  it('creates stable address and contact snapshots from an authoritative Customer', () => {
    expect(
      customerOperationalSnapshots({
        id: 'customer-a',
        displayName: 'Rivera Family',
        contactName: 'Alex Rivera',
        email: 'alex@example.com',
        phone: '555-0110',
        serviceAddressLine1: '10 Main Street',
        serviceAddressLine2: 'Gate B',
        serviceAddressCity: 'Hartford',
        serviceAddressRegion: 'CT',
        serviceAddressPostalCode: '06103',
        serviceAddressCountry: 'US',
      }),
    ).toEqual({
      customerDisplayName: 'Rivera Family',
      serviceLocationSnapshot: '10 Main Street\nGate B\nHartford, CT 06103\nUS',
      customerContactNameSnapshot: 'Alex Rivera',
      customerPhoneSnapshot: '555-0110',
      customerEmailSnapshot: 'alex@example.com',
    })
  })

  it('redacts execution context from unrelated Job viewers without mutating history', () => {
    const job = {
      customerReferenceId: 'legacy-customer-a',
      customerId: 'customer-a',
      customerDisplayName: 'Rivera Family',
      serviceLocationSnapshot: '10 Main Street',
      customerContactNameSnapshot: 'Alex Rivera',
      customerPhoneSnapshot: '555-0110',
      customerEmailSnapshot: 'alex@example.com',
    } as JobRecord

    expect(presentJobOperationalContext(job, false)).toMatchObject({
      customerReferenceId: null,
      customerId: null,
      customerDisplayName: null,
      serviceLocationSnapshot: null,
      customerContactNameSnapshot: null,
      customerPhoneSnapshot: null,
      customerEmailSnapshot: null,
    })
    expect(presentJobOperationalContext(job, true)).toBe(job)
    expect(job.serviceLocationSnapshot).toBe('10 Main Street')
  })
})
