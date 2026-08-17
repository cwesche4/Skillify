import { describe, expect, it } from 'vitest'

import {
  getLeadStageOptionsForBusinessModel,
  leadStageOptions,
  normalizeOpportunityStage,
  normalizeSaleStage,
  saleStageOptions,
  simpleServiceLeadStageOptions,
} from '@/lib/crm/pipelineStageRegistry'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'

describe('pipeline stage registry', () => {
  it('orders manually selectable Lead stages with Qualified before terminal outcomes', () => {
    expect(leadStageOptions).toEqual([
      'New',
      'Contacted',
      'Nurture',
      'Qualified',
      'Disqualified',
    ])
    expect(leadStageOptions.indexOf('Qualified')).toBeGreaterThan(
      leadStageOptions.indexOf('Nurture'),
    )
    expect(leadStageOptions.at(-1)).toBe('Disqualified')
    expect(leadStageOptions).not.toContain('Converted')
  })

  it('uses service-focused Lead stages for Simple Service workspaces', () => {
    expect(simpleServiceLeadStageOptions).toEqual([
      'New',
      'Contacted',
      'Estimate / Visit',
      'Follow-Up',
      'Won',
      'Lost',
    ])
    expect(
      getLeadStageOptionsForBusinessModel(
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      ),
    ).toEqual(simpleServiceLeadStageOptions)
  })

  it('preserves generic Lead stages for Direct and Consultative workspaces', () => {
    expect(
      getLeadStageOptionsForBusinessModel(WorkspaceBusinessModel.DIRECT_SALES),
    ).toEqual(leadStageOptions)
    expect(
      getLeadStageOptionsForBusinessModel(
        WorkspaceBusinessModel.CONSULTATIVE_SALES,
      ),
    ).toEqual(leadStageOptions)
  })

  it('exposes only Sale stages in the Sale stage registry', () => {
    expect(saleStageOptions).toEqual([
      'New',
      'Quote Preparation',
      'Quote Sent',
      'Negotiation',
      'Accepted',
      'Payment Pending',
      'Closed-Won',
      'Closed-Lost',
    ])
    expect(saleStageOptions).not.toContain('New Lead')
    expect(saleStageOptions).not.toContain('Qualified')
    expect(saleStageOptions).not.toContain('Discovery Scheduled')
    expect(saleStageOptions).not.toContain('Onboarding')
    expect(saleStageOptions).not.toContain('Won')
    expect(saleStageOptions).not.toContain('Lost')
  })

  it('normalizes legacy Sale terminal stages without duplicate meanings', () => {
    expect(normalizeSaleStage('Won')).toBe('Closed-Won')
    expect(normalizeSaleStage('Lost')).toBe('Closed-Lost')
    expect(normalizeSaleStage('Completed', 'Closed-Won')).toBe('Closed-Won')
    expect(normalizeSaleStage('Completed', 'Active')).toBe('Payment Pending')
  })

  it('normalizes legacy Opportunity stages without converting them to Sale stages', () => {
    expect(normalizeOpportunityStage('Discovery Scheduled')).toBe('Discovery')
    expect(normalizeOpportunityStage('Won')).toBe('Won')
    expect(normalizeOpportunityStage('Lost')).toBe('Lost')
  })
})
