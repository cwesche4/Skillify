import { describe, expect, it } from 'vitest'

import {
  generateVariantCombinations,
  getProductInventoryState,
  selectProductCounts,
  selectProducts,
  validateProductInput,
} from '@/lib/commerce/productCatalog'
import { normalizePreviewProduct } from '@/lib/commerce/previewCommerceStorage'
import type { CommerceProduct } from '@/lib/commerce/types'

function product(input: Partial<CommerceProduct>) {
  return normalizePreviewProduct(
    {
      id: input.id ?? `product-${input.name}`,
      workspaceId: input.workspaceId ?? 'workspace-a',
      name: input.name ?? 'Product',
      status: input.status ?? 'ACTIVE',
      price: input.price ?? { amount: 10, currency: 'USD' },
      taxable: true,
      trackInventory: input.trackInventory ?? false,
      hasVariants: input.hasVariants ?? false,
      variants: input.variants ?? [],
      createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
      updatedAt: input.updatedAt ?? '2026-01-01T00:00:00.000Z',
      ...input,
    },
    input.workspaceId ?? 'workspace-a',
  )
}

describe('commerce product catalog selectors and validation', () => {
  const products = [
    product({
      id: 'active',
      name: 'Energy Drink',
      sku: 'ENERGY-001',
      category: 'Beverages',
      vendor: 'Demo Supply',
      tags: ['retail'],
      status: 'ACTIVE',
      price: { amount: 4, currency: 'USD' },
      trackInventory: true,
      inventoryQuantity: 3,
      lowStockThreshold: 5,
    }),
    product({
      id: 'draft',
      name: 'Subscription Box',
      sku: 'SUB-001',
      category: 'Subscriptions',
      vendor: 'Demo Supply',
      status: 'DRAFT',
      price: { amount: 39, currency: 'USD' },
      updatedAt: '2026-02-01T00:00:00.000Z',
    }),
    product({
      id: 'archived',
      name: 'Limited Product',
      sku: 'LIM-001',
      status: 'ARCHIVED',
      price: { amount: 20, currency: 'USD' },
      hasVariants: true,
      variants: [
        {
          id: 'variant-a',
          workspaceId: 'workspace-a',
          productId: 'archived',
          name: 'Blue',
          optionValues: { Color: 'Blue' },
          sku: 'LIM-BLUE',
          status: 'ARCHIVED',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }),
  ]

  it('keeps saved-view counts aligned with selector rows', () => {
    const counts = selectProductCounts(products)
    expect(counts).toMatchObject({
      all: selectProducts(products, { view: 'all' }).length,
      active: selectProducts(products, { view: 'active' }).length,
      draft: selectProducts(products, { view: 'draft' }).length,
      archived: selectProducts(products, { view: 'archived' }).length,
      lowStock: selectProducts(products, { view: 'low-stock' }).length,
    })
  })

  it('searches product, SKU, category, vendor, tags, and variants', () => {
    expect(selectProducts(products, { query: 'energy' })).toHaveLength(1)
    expect(selectProducts(products, { query: 'SUB-001' })).toHaveLength(1)
    expect(selectProducts(products, { query: 'beverages' })).toHaveLength(1)
    expect(selectProducts(products, { query: 'demo supply' })).toHaveLength(2)
    expect(selectProducts(products, { query: 'retail' })).toHaveLength(1)
    expect(selectProducts(products, { query: 'LIM-BLUE' })).toHaveLength(1)
  })

  it('filters inventory states and sorts stably', () => {
    expect(getProductInventoryState(products[0]!)).toBe('LOW_STOCK')
    expect(selectProducts(products, { inventory: 'LOW_STOCK' })).toHaveLength(1)
    expect(selectProducts(products, { inventory: 'NOT_TRACKED' })).toHaveLength(
      2,
    )
    expect(
      selectProducts(products, { sort: 'price-desc' }).map((p) => p.id),
    ).toEqual(['draft', 'archived', 'active'])
  })

  it('counts low stock only when tracking and thresholds make inventory actionable', () => {
    const lowStockProducts = [
      product({
        id: 'tracked-low',
        name: 'Tracked Low',
        trackInventory: true,
        inventoryQuantity: 4,
        lowStockThreshold: 5,
      }),
      product({
        id: 'tracked-safe',
        name: 'Tracked Safe',
        trackInventory: true,
        inventoryQuantity: 8,
        lowStockThreshold: 5,
      }),
      product({
        id: 'missing-threshold',
        name: 'Missing Threshold',
        trackInventory: true,
        inventoryQuantity: 1,
      }),
      product({
        id: 'untracked-low-looking',
        name: 'Untracked Low Looking',
        trackInventory: false,
        inventoryQuantity: 1,
        lowStockThreshold: 5,
      }),
      product({
        id: 'variant-low',
        name: 'Variant Low',
        trackInventory: true,
        lowStockThreshold: 3,
        hasVariants: true,
        variants: [
          {
            id: 'variant-low-a',
            workspaceId: 'workspace-a',
            productId: 'variant-low',
            name: 'Small',
            optionValues: { Size: 'Small' },
            inventoryQuantity: 2,
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    ]

    expect(selectProductCounts(lowStockProducts).lowStock).toBe(2)
    expect(
      selectProducts(lowStockProducts, { view: 'low-stock' }).map(
        (item) => item.id,
      ),
    ).toEqual(['tracked-low', 'variant-low'])
  })

  it('validates required and non-negative fields', () => {
    const result = validateProductInput({
      input: {
        name: '',
        price: { amount: -1, currency: 'USD' },
        cost: { amount: -1, currency: 'USD' },
        inventoryQuantity: -2,
        lowStockThreshold: -1,
      },
      existingProducts: [],
      workspaceId: 'workspace-a',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.name).toBe('Product name is required.')
    expect(result.errors.price).toBe('Price cannot be negative.')
    expect(result.errors.cost).toBe('Cost cannot be negative.')
    expect(result.errors.inventoryQuantity).toBe(
      'Inventory cannot be negative.',
    )
    expect(result.errors.lowStockThreshold).toBe(
      'Low-stock threshold cannot be negative.',
    )
  })

  it('validates workspace-scoped SKU uniqueness', () => {
    expect(
      validateProductInput({
        input: { name: 'Copy', sku: 'ENERGY-001', price: { amount: 1 } },
        existingProducts: products,
        workspaceId: 'workspace-a',
      }).errors.sku,
    ).toBe('SKU must be unique in this workspace.')
    expect(
      validateProductInput({
        input: {
          name: 'Other Workspace',
          sku: 'ENERGY-001',
          price: { amount: 1 },
        },
        existingProducts: products,
        workspaceId: 'workspace-b',
      }).valid,
    ).toBe(true)
  })

  it('generates variant combinations and enforces the preview limit', () => {
    expect(
      generateVariantCombinations([
        { name: 'Flavor', values: ['Original', 'Berry'] },
        { name: 'Size', values: ['12 oz', '16 oz'] },
      ]),
    ).toHaveLength(4)
    expect(
      generateVariantCombinations([
        { name: 'A', values: Array.from({ length: 11 }, (_, i) => `${i}`) },
        { name: 'B', values: Array.from({ length: 10 }, (_, i) => `${i}`) },
      ]),
    ).toBeNull()
    expect(
      generateVariantCombinations([
        { name: 'Flavor', values: ['Original', 'original', 'Berry'] },
      ])?.map((combination) => combination.Flavor),
    ).toEqual(['Original', 'Berry'])
  })
})
