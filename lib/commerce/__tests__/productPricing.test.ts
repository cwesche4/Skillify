import { describe, expect, it } from 'vitest'

import {
  calculateCommerceMargin,
  formatProductPriceRange,
} from '@/lib/commerce/productPricing'
import { normalizePreviewProduct } from '@/lib/commerce/previewCommerceStorage'

describe('commerce product pricing', () => {
  it('calculates margin amount and retail margin percentage', () => {
    const margin = calculateCommerceMargin({
      price: { amount: 40, currency: 'USD' },
      cost: { amount: 15, currency: 'USD' },
    })
    expect(margin.amount).toBe(25)
    expect(margin.percentage).toBe(62.5)
  })

  it('does not return NaN or Infinity for missing cost or zero price', () => {
    expect(
      calculateCommerceMargin({ price: { amount: 40, currency: 'USD' } }),
    ).toMatchObject({ available: false, amount: null, percentage: null })
    expect(
      calculateCommerceMargin({
        price: { amount: 0, currency: 'USD' },
        cost: { amount: 0, currency: 'USD' },
      }),
    ).toMatchObject({ available: false, amount: 0, percentage: null })
  })

  it('formats variant price ranges', () => {
    const product = normalizePreviewProduct(
      {
        id: 'product',
        workspaceId: 'workspace-a',
        name: 'Variant Product',
        status: 'ACTIVE',
        price: { amount: 10, currency: 'USD' },
        taxable: true,
        trackInventory: false,
        hasVariants: true,
        variants: [
          {
            id: 'variant-a',
            workspaceId: 'workspace-a',
            productId: 'product',
            name: 'Small',
            optionValues: { Size: 'Small' },
            status: 'ACTIVE',
            price: { amount: 10, currency: 'USD' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'variant-b',
            workspaceId: 'workspace-a',
            productId: 'product',
            name: 'Large',
            optionValues: { Size: 'Large' },
            status: 'ACTIVE',
            price: { amount: 12, currency: 'USD' },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      'workspace-a',
    )

    expect(formatProductPriceRange(product)).toBe('$10.00 - $12.00')
  })
})
