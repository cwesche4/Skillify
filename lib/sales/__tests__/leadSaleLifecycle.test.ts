import { beforeEach, describe, expect, it } from 'vitest'

import { readPreviewClients } from '@/lib/clients/previewClientStorage'
import {
  LeadConversionDestination,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import { demoLeads, demoOpportunities } from '@/lib/sales/demoSalesRecords'
import {
  convertLeadForWorkspacePreview,
  getMergedWorkspaceOpportunities,
} from '@/lib/sales/previewOpportunityStorage'
import {
  moveSaleStage,
  normalizeSaleRecord,
  readPreviewSales,
  upsertPreviewSale,
} from '@/lib/sales/previewSaleStorage'
import { readPreviewLeads } from '@/lib/sales/previewLeadStorage'
import { markOpportunityWon } from '@/lib/workspace-records/salesFlow'
import { selectLeadsNeedingFollowUp } from '@/lib/workspace-records/relationships'

const workspaceId = 'lifecycle-test-workspace'

describe('lead to sale lifecycle alignment', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('converts a lead directly to exactly one Sale and creates no Opportunity', () => {
    const result = convertLeadForWorkspacePreview(
      workspaceId,
      'lead-rachel-adams',
      {
        workspace: {
          opportunitiesEnabled: false,
          commerceEnabled: false,
          defaultLeadDestination: LeadConversionDestination.SALE,
          allowDirectLeadToSale: true,
        },
        request: { requestedDestination: LeadConversionDestination.SALE },
      },
    )

    expect(result.destination).toBe(LeadConversionDestination.SALE)
    expect(result.record?.id).toBe('sale-from-lead-lead-rachel-adams')
    expect(readPreviewSales(workspaceId)).toHaveLength(1)
    expect(readPreviewSales(workspaceId)[0]).toMatchObject({
      name: 'Adams Bookkeeping Sale',
      contactName: 'Rachel Adams',
      company: 'Adams Bookkeeping',
      sourceLeadId: 'lead-rachel-adams',
      stage: 'New',
    })
    expect(getMergedWorkspaceOpportunities(workspaceId)).not.toContainEqual(
      expect.objectContaining({ sourceLeadId: 'lead-rachel-adams' }),
    )
  })

  it('marks converted leads as history and removes them from active follow-up queues', () => {
    convertLeadForWorkspacePreview(workspaceId, 'lead-rachel-adams', {
      workspace: {
        opportunitiesEnabled: false,
        commerceEnabled: false,
        defaultLeadDestination: LeadConversionDestination.SALE,
        allowDirectLeadToSale: true,
      },
      request: { requestedDestination: LeadConversionDestination.SALE },
    })

    const convertedLead = readPreviewLeads(workspaceId).find(
      (lead) => lead.id === 'lead-rachel-adams',
    )

    expect(convertedLead).toMatchObject({
      converted: true,
      stage: 'New Lead',
      convertedDestination: LeadConversionDestination.SALE,
      connectedRecordType: 'Sale',
      nextStep: 'None - converted',
    })
    expect(convertedLead?.followUpDue).toBeUndefined()
    expect(selectLeadsNeedingFollowUp([convertedLead!])).toHaveLength(0)
  })

  it('blocks duplicate direct Sale conversion for the same Lead', () => {
    convertLeadForWorkspacePreview(workspaceId, 'lead-rachel-adams', {
      workspace: {
        opportunitiesEnabled: false,
        commerceEnabled: false,
        defaultLeadDestination: LeadConversionDestination.SALE,
        allowDirectLeadToSale: true,
      },
      request: { requestedDestination: LeadConversionDestination.SALE },
    })
    const duplicate = convertLeadForWorkspacePreview(
      workspaceId,
      'lead-rachel-adams',
      {
        workspace: {
          opportunitiesEnabled: false,
          commerceEnabled: false,
          defaultLeadDestination: LeadConversionDestination.SALE,
          allowDirectLeadToSale: true,
        },
        request: { requestedDestination: LeadConversionDestination.SALE },
      },
    )

    expect(duplicate.record).toBeNull()
    expect(duplicate.message).toMatch(/already been converted/i)
    expect(readPreviewSales(workspaceId)).toHaveLength(1)
  })

  it('converts a Lead to Opportunity without creating a Sale yet', () => {
    const result = convertLeadForWorkspacePreview(
      workspaceId,
      'lead-rachel-adams',
      {
        workspace: {
          opportunitiesEnabled: true,
          commerceEnabled: false,
          defaultLeadDestination: LeadConversionDestination.OPPORTUNITY,
          allowDirectLeadToSale: true,
        },
        request: {
          requestedDestination: LeadConversionDestination.OPPORTUNITY,
        },
      },
    )

    expect(result.destination).toBe(LeadConversionDestination.OPPORTUNITY)
    expect(getMergedWorkspaceOpportunities(workspaceId)).toContainEqual(
      expect.objectContaining({
        sourceLeadId: 'lead-rachel-adams',
        contactName: 'Rachel Adams',
      }),
    )
    expect(readPreviewSales(workspaceId)).toHaveLength(0)
  })

  it('converts a Service Business Lead directly into one visible canonical Customer client', () => {
    const result = convertLeadForWorkspacePreview(
      workspaceId,
      'lead-rachel-adams',
      {
        workspace: {
          businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
          opportunitiesEnabled: false,
          commerceEnabled: false,
          defaultLeadDestination: LeadConversionDestination.CUSTOMER,
          allowDirectLeadToSale: false,
          customerSingularLabel: 'Customer',
          customerPluralLabel: 'Customers',
        },
        request: { requestedDestination: LeadConversionDestination.CUSTOMER },
      },
    )
    const duplicate = convertLeadForWorkspacePreview(
      workspaceId,
      'lead-rachel-adams',
      {
        workspace: {
          businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
          opportunitiesEnabled: false,
          commerceEnabled: false,
          defaultLeadDestination: LeadConversionDestination.CUSTOMER,
          allowDirectLeadToSale: false,
          customerSingularLabel: 'Customer',
          customerPluralLabel: 'Customers',
        },
        request: { requestedDestination: LeadConversionDestination.CUSTOMER },
      },
    )
    const convertedLead = readPreviewLeads(workspaceId).find(
      (lead) => lead.id === 'lead-rachel-adams',
    )
    const clients = readPreviewClients(workspaceId)

    expect(result.destination).toBe(LeadConversionDestination.CUSTOMER)
    expect(result.record?.id).toBe('client-from-lead-lead-rachel-adams')
    expect(clients).toHaveLength(1)
    expect(clients[0]).toMatchObject({
      id: 'client-from-lead-lead-rachel-adams',
      workspaceId,
      sourceLeadId: 'lead-rachel-adams',
      name: 'Rachel Adams',
      company: 'Adams Bookkeeping',
      email: '',
      phone: '',
      status: 'Active',
      pipelineStage: 'Onboarding',
    })
    expect(convertedLead).toMatchObject({
      converted: true,
      convertedDestination: LeadConversionDestination.CUSTOMER,
      connectedRecordId: 'client-from-lead-lead-rachel-adams',
      connectedRecordType: 'Customer',
      status: 'Converted',
      stage: 'Won',
      nextStep: 'None - converted',
    })
    expect(duplicate.record).toBeNull()
    expect(duplicate.message).toMatch(/already been converted/i)
    expect(readPreviewClients(workspaceId)).toHaveLength(1)
  })

  it('marks Opportunity won and creates exactly one related Sale', () => {
    const opportunity = {
      ...demoOpportunities[0],
      id: 'opp-lifecycle-test',
      contactName: 'Rachel Adams',
      company: 'Adams Bookkeeping',
      sourceLeadId: 'lead-rachel-adams',
    }
    const result = markOpportunityWon(workspaceId, opportunity)
    upsertPreviewSale(workspaceId, normalizeSaleRecord(result.sale))
    upsertPreviewSale(workspaceId, normalizeSaleRecord(result.sale))

    expect(result.opportunity).toMatchObject({
      status: 'Closed-Won',
      stage: 'Won',
      saleId: 'sale-from-opportunity-opp-lifecycle-test',
    })
    expect(readPreviewSales(workspaceId)).toHaveLength(1)
    expect(readPreviewSales(workspaceId)[0]).toMatchObject({
      sourceOpportunityId: 'opp-lifecycle-test',
      sourceLeadId: 'lead-rachel-adams',
      contactName: 'Rachel Adams',
      company: 'Adams Bookkeeping',
    })
  })

  it('creates or connects one Client when a Sale reaches a terminal won stage', () => {
    const sale = normalizeSaleRecord({
      id: 'sale-terminal-test',
      name: 'Adams Bookkeeping Sale',
      contactName: 'Rachel Adams',
      company: 'Adams Bookkeeping',
      value: 1200,
      ownerId: demoLeads[0].ownerId,
      sourceLeadId: demoLeads[0].id,
    })

    const accepted = moveSaleStage(workspaceId, sale, 'Closed-Won')
    upsertPreviewSale(workspaceId, accepted.sale)
    const repeated = moveSaleStage(workspaceId, accepted.sale, 'Completed')
    upsertPreviewSale(workspaceId, repeated.sale)

    expect(readPreviewClients(workspaceId)).toHaveLength(1)
    expect(readPreviewClients(workspaceId)[0]).toMatchObject({
      company: 'Adams Bookkeeping',
      name: 'Rachel Adams',
    })
    expect(readPreviewSales(workspaceId)).toHaveLength(1)
    expect(readPreviewSales(workspaceId)[0].clientId).toBe(
      readPreviewClients(workspaceId)[0].id,
    )
  })

  it('keeps Accepted active and does not create a Client until Closed-Won', () => {
    const sale = normalizeSaleRecord({
      id: 'sale-accepted-test',
      name: 'Accepted Sale',
      contactName: 'Rachel Adams',
      company: 'Adams Bookkeeping',
      value: 1200,
      ownerId: demoLeads[0].ownerId,
    })

    const result = moveSaleStage(workspaceId, sale, 'Accepted')

    expect(result.client).toBeUndefined()
    expect(result.sale.status).toBe('Active')
    expect(result.sale.stage).toBe('Accepted')
    expect(readPreviewClients(workspaceId)).toHaveLength(0)
  })

  it('does not create a Client when a Sale is closed lost', () => {
    const sale = normalizeSaleRecord({
      id: 'sale-lost-test',
      name: 'Lost Sale',
      contactName: 'Rachel Adams',
      company: 'Adams Bookkeeping',
      value: 1200,
      ownerId: demoLeads[0].ownerId,
    })

    const result = moveSaleStage(workspaceId, sale, 'Closed-Lost')

    expect(result.client).toBeUndefined()
    expect(result.sale.status).toBe('Closed-Lost')
    expect(readPreviewClients(workspaceId)).toHaveLength(0)
  })
})
