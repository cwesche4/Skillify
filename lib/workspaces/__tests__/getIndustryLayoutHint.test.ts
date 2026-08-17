import { describe, expect, it } from 'vitest'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  getIndustryLayoutHint,
  normalizeIndustry,
} from '@/lib/workspaces/getIndustryLayoutHint'

describe('getIndustryLayoutHint', () => {
  it.each(['Ecom', 'E-commerce', 'e commerce', '  E-COMMERCE  '])(
    'maps %s to Product & Commerce',
    (industry) => {
      const hint = getIndustryLayoutHint(industry)
      expect(hint?.model).toBe(WorkspaceBusinessModel.PRODUCT_COMMERCE)
      expect(hint?.confidence).toBe('HIGH')
      expect(hint?.label).toBe('Product & Commerce')
    },
  )

  it('maps Marketing agency to Consultative Sales', () => {
    expect(getIndustryLayoutHint('Marketing agency')?.model).toBe(
      WorkspaceBusinessModel.CONSULTATIVE_SALES,
    )
  })

  it('maps Plumbing to Service Business', () => {
    const hint = getIndustryLayoutHint('Plumbing')
    expect(hint?.model).toBe(WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS)
    expect(hint?.confidence).toBe('HIGH')
    expect(hint?.label).toBe('Service Business')
  })

  it.each([
    'Lawn services',
    'Residential lawn mowing and landscaping',
    'Commercial HVAC',
    'heating and cooling',
    'garage door service',
  ])('maps service wording variant %s to Service Business', (industry) => {
    expect(getIndustryLayoutHint(industry)?.model).toBe(
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    )
  })

  it('normalizes case, whitespace, and punctuation variants', () => {
    expect(normalizeIndustry('  E---Commerce!!  ')).toBe('e commerce')
    expect(getIndustryLayoutHint('  plumbing!!  ')?.model).toBe(
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    )
  })

  it.each([
    'construction',
    'manufacturing',
    'technology',
    'healthcare',
    'real estate',
    'professional services',
    'local services',
    'other',
  ])('returns null for ambiguous industry %s', (industry) => {
    expect(getIndustryLayoutHint(industry)).toBeNull()
  })
})
