import { describe, expect, it } from 'vitest'

import { normalizeSalesProcessConfig } from '@/lib/workspaces/normalizeSalesProcessConfig'

describe('normalizeSalesProcessConfig', () => {
  it('does not allow Opportunity as the destination when Opportunities is disabled', () => {
    expect(
      normalizeSalesProcessConfig({
        businessModel: 'CONSULTATIVE_SALES',
        opportunitiesEnabled: false,
        commerceEnabled: false,
        defaultLeadDestination: 'OPPORTUNITY',
      }).defaultLeadDestination,
    ).toBe('SALE')
  })

  it('keeps Opportunity as the consultative default when Opportunities are enabled', () => {
    expect(
      normalizeSalesProcessConfig({
        businessModel: 'CONSULTATIVE_SALES',
        opportunitiesEnabled: true,
        commerceEnabled: false,
      }).defaultLeadDestination,
    ).toBe('OPPORTUNITY')
  })

  it('keeps Customer as the simple service default without commerce', () => {
    expect(
      normalizeSalesProcessConfig({
        businessModel: 'SIMPLE_SERVICE_BUSINESS',
        opportunitiesEnabled: false,
        commerceEnabled: false,
        defaultLeadDestination: 'CUSTOMER',
      }).defaultLeadDestination,
    ).toBe('CUSTOMER')
  })
})
