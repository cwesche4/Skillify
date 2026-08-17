import { describe, expect, it } from 'vitest'

import { getRecordTypeDisplayName } from '@/lib/workspace-records/recordTypeDisplay'

describe('recordTypeDisplay', () => {
  it('uses workspace terminology for service request records', () => {
    expect(
      getRecordTypeDisplayName({
        recordType: 'serviceRequest',
        terminology: {
          customerSingular: 'Customer',
          customerPlural: 'Customers',
          serviceRequestSingular: 'Job',
          serviceRequestPlural: 'Jobs',
          taskSingular: 'Job Step',
          taskPlural: 'Job Steps',
        },
      }),
    ).toBe('Job')
  })

  it('keeps canonical identifiers separate from display labels', () => {
    expect(
      getRecordTypeDisplayName({
        recordType: 'serviceRequest',
        terminology: {
          customerSingular: 'Client',
          customerPlural: 'Clients',
          serviceRequestSingular: 'Service Request',
          serviceRequestPlural: 'Service Requests',
          taskSingular: 'Task',
          taskPlural: 'Tasks',
        },
      }),
    ).toBe('Service Request')
  })

  it('uses workspace terminology for customer and task records', () => {
    const terminology = {
      customerSingular: 'Customer',
      customerPlural: 'Customers',
      serviceRequestSingular: 'Job',
      serviceRequestPlural: 'Jobs',
      taskSingular: 'Job Step',
      taskPlural: 'Job Steps',
    }

    expect(
      getRecordTypeDisplayName({ recordType: 'client', terminology }),
    ).toBe('Customer')
    expect(
      getRecordTypeDisplayName({
        recordType: 'task',
        terminology,
        plural: true,
      }),
    ).toBe('Job Steps')
  })
})
