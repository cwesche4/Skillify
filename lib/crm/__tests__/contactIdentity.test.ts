import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyIdentityToLead,
  applyIdentityToClient,
  applyIdentityToOpportunity,
  applyIdentityToSale,
  ensureContactIdentity,
  readContactIdentities,
  upsertContactIdentity,
} from '@/lib/crm/contactIdentity'
import { normalizeSaleRecord } from '@/lib/sales/previewSaleStorage'
import type {
  LeadRecord,
  OpportunityRecord,
} from '@/lib/sales/demoSalesRecords'
import type { WorkspaceClient } from '@/lib/clients/types'

function lead(): LeadRecord {
  return {
    id: 'lead-rachel',
    name: 'Rachel Adams',
    company: 'Adams Bookkeeping',
    status: 'Qualified',
    stage: 'Qualified',
    source: 'Website Form',
    value: 1200,
    nextStep: 'Follow up',
    ownerId: 'owner',
    createdAt: '2026-06-01',
    converted: false,
    notes: 'Record note',
  }
}

describe('shared contact identity', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('keeps shared contact notes separate from record notes and applies identity to downstream records', () => {
    const identity = upsertContactIdentity('workspace-a', {
      ...ensureContactIdentity('workspace-a', lead()),
      email: 'rachel@example.com',
      phone: '+1 555 555 1234',
      sharedNotes: 'Prefers text messages.',
    })
    const nextLead = applyIdentityToLead(lead(), identity)
    const sourceOpportunity: OpportunityRecord = {
      id: 'opp-1',
      name: 'Bookkeeping Automation Project',
      client: nextLead.company,
      status: 'Active',
      stage: 'Discovery',
      value: 1200,
      probability: 45,
      ownerId: nextLead.ownerId,
      nextStep: 'Discovery',
      lastActivityAt: '2026-06-02',
      sourceLeadId: nextLead.id,
    }
    const opportunity = applyIdentityToOpportunity(sourceOpportunity, identity)
    const sale = applyIdentityToSale(
      normalizeSaleRecord({
        id: 'sale-1',
        name: 'Adams Bookkeeping Sale',
        contactName: opportunity.contactName ?? opportunity.client,
        company: opportunity.company ?? opportunity.client,
        value: opportunity.value,
        ownerId: opportunity.ownerId,
        sourceLeadId: opportunity.sourceLeadId,
        sourceOpportunityId: opportunity.id,
      }),
      identity,
    )
    const client: WorkspaceClient = applyIdentityToClient(
      {
        id: 'client-1',
        workspaceId: 'workspace-a',
        name: sale.contactName,
        company: sale.company,
        email: sale.contactEmail ?? '',
        phone: sale.contactPhone ?? '',
        status: 'Active',
        pipelineStage: 'Onboarding',
        lastActivity: '2026-06-03',
        openTasks: 0,
        value: sale.value,
        nextAction: 'Start onboarding',
        ownerId: sale.ownerId,
        health: 'Healthy',
        tags: [],
        internalNotes: 'Client-specific internal note',
        notes: 'Client-specific internal note',
        activity: [],
        tasks: [],
        suggestedAutomations: [],
        opportunity: {
          value: sale.value,
          nextAction: 'Start onboarding',
          probability: 100,
          expectedCloseWindow: 'Closed-Won',
        },
      },
      identity,
    )

    expect(nextLead.notes).toBe('Record note')
    expect(nextLead.leadNotes).toBeUndefined()
    expect(sourceOpportunity.notes).toBeUndefined()
    expect(sourceOpportunity.opportunityNotes).toBeUndefined()
    expect(opportunity.contactEmail).toBe('rachel@example.com')
    expect(sale.contactPhone).toBe('+1 555 555 1234')
    expect(client.sharedContactId).toBe(identity.id)
    expect(client.notes).toBe('Client-specific internal note')
    expect(client.internalNotes).toBe('Client-specific internal note')
    expect(readContactIdentities('workspace-a')[0].sharedNotes).toBe(
      'Prefers text messages.',
    )
    expect(readContactIdentities('workspace-b')).toEqual([])
  })

  it('updates shared client notes without overwriting pipeline-specific notes', () => {
    const identity = ensureContactIdentity('workspace-a', lead())
    upsertContactIdentity('workspace-a', {
      ...identity,
      sharedNotes: 'Do not schedule before 10 AM.',
    })

    const pipelineNotes = {
      leadNotes: 'Lead asked about intake forms.',
      opportunityNotes: 'Proposal needs compliance language.',
      saleNotes: 'Payment due before kickoff.',
      internalNotes: 'Escalate renewal to owner.',
    }

    const updatedIdentity = upsertContactIdentity('workspace-a', {
      ...identity,
      sharedNotes: 'Prefers text messages.',
    })

    expect(readContactIdentities('workspace-a')[0].sharedNotes).toBe(
      'Prefers text messages.',
    )
    expect(updatedIdentity.sharedNotes).toBe('Prefers text messages.')
    expect(pipelineNotes).toEqual({
      leadNotes: 'Lead asked about intake forms.',
      opportunityNotes: 'Proposal needs compliance language.',
      saleNotes: 'Payment due before kickoff.',
      internalNotes: 'Escalate renewal to owner.',
    })
  })
})
