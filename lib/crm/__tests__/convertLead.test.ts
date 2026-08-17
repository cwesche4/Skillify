import { describe, expect, it } from 'vitest'

import {
  determineLeadConversionDestination,
  getAvailableLeadConversionDestinations,
} from '@/lib/crm/convertLead'
import {
  LeadConversionDestination,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

describe('lead conversion routing', () => {
  it('defaults to Opportunity when opportunities are enabled', () => {
    const result = determineLeadConversionDestination({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      opportunitiesEnabled: true,
      defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
    })

    expect(result.destination).toBe(LeadConversionDestination.OPPORTUNITY)
  })

  it('defaults to Sale when opportunities are disabled', () => {
    const result = determineLeadConversionDestination({
      businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      opportunitiesEnabled: false,
      defaultLeadDestination: LeadConversionDestination.SALE,
    })

    expect(result.destination).toBe(LeadConversionDestination.SALE)
  })

  it('defaults to Customer for Simple Service Business', () => {
    const result = determineLeadConversionDestination({
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    })

    expect(result.destination).toBe(LeadConversionDestination.CUSTOMER)
  })

  it('rejects Opportunity as an available destination when disabled', () => {
    const capabilities = getWorkspaceCapabilities({
      opportunitiesEnabled: false,
      defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
    })

    expect(getAvailableLeadConversionDestinations(capabilities)).not.toContain(
      LeadConversionDestination.OPPORTUNITY,
    )
    expect(() =>
      determineLeadConversionDestination(capabilities, {
        requestedDestination: LeadConversionDestination.OPPORTUNITY,
      }),
    ).toThrow(/unavailable/i)
  })

  it('allows direct-to-Sale override only when allowed', () => {
    const allowed = getWorkspaceCapabilities({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      opportunitiesEnabled: true,
      defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
      allowDirectLeadToSale: true,
    })
    const blocked = getWorkspaceCapabilities({
      businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
      opportunitiesEnabled: true,
      defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
      allowDirectLeadToSale: false,
    })

    expect(
      determineLeadConversionDestination(allowed, {
        requestedDestination: LeadConversionDestination.SALE,
      }).destination,
    ).toBe(LeadConversionDestination.SALE)
    expect(() =>
      determineLeadConversionDestination(blocked, {
        requestedDestination: LeadConversionDestination.SALE,
      }),
    ).toThrow(/unavailable/i)
  })

  it('does not route product commerce without commerce leads enabled', () => {
    expect(() =>
      determineLeadConversionDestination({
        businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
        commerceEnabled: true,
        defaultLeadDestination: LeadConversionDestination.CUSTOMER,
      }),
    ).toThrow(/unavailable/i)
  })
})
