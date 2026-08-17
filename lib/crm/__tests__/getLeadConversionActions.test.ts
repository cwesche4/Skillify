import { describe, expect, it } from 'vitest'

import { getLeadConversionActions } from '@/lib/crm/getLeadConversionActions'
import {
  LeadConversionDestination,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

describe('lead conversion actions', () => {
  it('returns only Sale when opportunities are disabled', () => {
    const actions = getLeadConversionActions(
      getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.DIRECT_SALES,
        opportunitiesEnabled: false,
      }),
    )

    expect(actions.map((action) => action.destination)).toEqual([
      LeadConversionDestination.SALE,
    ])
  })

  it('returns direct customer conversion for Simple Service Business', () => {
    const actions = getLeadConversionActions(
      getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      }),
    )

    expect(actions.map((action) => action.destination)).toEqual([
      LeadConversionDestination.CUSTOMER,
    ])
    expect(actions[0]?.label).toBe('Convert to Customer')
  })

  it('orders Opportunity first when it is the default and direct Sale is allowed', () => {
    const actions = getLeadConversionActions(
      getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
        opportunitiesEnabled: true,
        defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
        allowDirectLeadToSale: true,
      }),
    )

    expect(actions.map((action) => action.destination)).toEqual([
      LeadConversionDestination.OPPORTUNITY,
      LeadConversionDestination.SALE,
    ])
    expect(actions[0]?.isDefault).toBe(true)
  })

  it('orders Sale first when it is the default and direct Sale is allowed', () => {
    const actions = getLeadConversionActions(
      getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
        opportunitiesEnabled: true,
        defaultLeadDestination: LeadConversionDestination.SALE,
        allowDirectLeadToSale: true,
      }),
    )

    expect(actions.map((action) => action.destination)).toEqual([
      LeadConversionDestination.SALE,
      LeadConversionDestination.OPPORTUNITY,
    ])
  })

  it('returns only the configured default when direct Sale is not allowed', () => {
    const actions = getLeadConversionActions(
      getWorkspaceCapabilities({
        businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
        opportunitiesEnabled: true,
        defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
        allowDirectLeadToSale: false,
      }),
    )

    expect(actions.map((action) => action.destination)).toEqual([
      LeadConversionDestination.OPPORTUNITY,
    ])
  })

  it('returns no actions for converted leads or commerce workspaces without leads', () => {
    const crmCapabilities = getWorkspaceCapabilities({
      businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      opportunitiesEnabled: false,
    })
    const commerceCapabilities = getWorkspaceCapabilities({
      businessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
      commerceEnabled: true,
    })

    expect(
      getLeadConversionActions(crmCapabilities, { converted: true }),
    ).toEqual([])
    expect(getLeadConversionActions(commerceCapabilities)).toEqual([])
  })
})
