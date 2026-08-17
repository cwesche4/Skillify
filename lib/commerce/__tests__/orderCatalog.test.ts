import { describe, expect, it } from 'vitest'

import {
  calculateOrderInventoryImpact,
  calculateOrderTotals,
  formatCommerceAddress,
  formatCommerceAddressLines,
  getCustomerOrderMetrics,
  getEffectiveShippingAddress,
  getMeaningfulOptionalIdentityValue,
  getOrderCustomerLabel,
  getOrderLinePresentation,
  isMeaningfulOptionalIdentityValue,
  normalizeCommerceAddress,
  selectOrderCounts,
  selectOrders,
  validateOrderInput,
} from '@/lib/commerce/orderCatalog'
import {
  normalizePreviewOrder,
  normalizePreviewProduct,
} from '@/lib/commerce/previewCommerceStorage'
import type {
  CommerceCustomer,
  CommerceOrder,
  CommerceProduct,
} from '@/lib/commerce/types'

function order(input: Partial<CommerceOrder>) {
  return normalizePreviewOrder(
    {
      id: input.id ?? `order-${input.orderNumber}`,
      workspaceId: input.workspaceId ?? 'workspace-a',
      orderNumber: input.orderNumber ?? 'ORD-01001',
      status: input.status ?? 'PENDING',
      paymentStatus: input.paymentStatus ?? 'UNPAID',
      fulfillmentStatus: input.fulfillmentStatus ?? 'UNFULFILLED',
      currency: input.currency ?? 'USD',
      lines: input.lines ?? [
        {
          id: 'line-1',
          orderId: input.id ?? 'order-1',
          name: 'Energy Drink',
          quantity: 2,
          unitPrice: 4,
          discountTotal: 1,
          taxTotal: 0.5,
          subtotal: 8,
          lineTotal: 7.5,
        },
      ],
      createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
      updatedAt: input.updatedAt ?? '2026-01-01T00:00:00.000Z',
      ...input,
    },
    input.workspaceId ?? 'workspace-a',
  )
}

function product(input: Partial<CommerceProduct>) {
  return normalizePreviewProduct(
    {
      id: input.id ?? 'product-a',
      workspaceId: input.workspaceId ?? 'workspace-a',
      name: input.name ?? 'Energy Drink',
      status: input.status ?? 'ACTIVE',
      price: input.price ?? { amount: 4, currency: 'USD' },
      taxable: true,
      trackInventory: input.trackInventory ?? true,
      inventoryQuantity: input.inventoryQuantity ?? 10,
      hasVariants: input.hasVariants ?? false,
      variants: input.variants ?? [],
      createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
      updatedAt: input.updatedAt ?? '2026-01-01T00:00:00.000Z',
      ...input,
    },
    input.workspaceId ?? 'workspace-a',
  )
}

const customers: CommerceCustomer[] = [
  {
    id: 'customer-a',
    workspaceId: 'workspace-a',
    relationshipKind: 'COMMERCE_CUSTOMER',
    displayName: 'NorthStar Electric',
    email: 'owner@northstar.com',
    lifecycleStatus: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

describe('commerce order catalog selectors and validation', () => {
  it('detects meaningful optional identity values for read-only display', () => {
    expect(isMeaningfulOptionalIdentityValue('NorthStar Holdings')).toBe(true)
    expect(isMeaningfulOptionalIdentityValue('  NorthStar Holdings  ')).toBe(
      true,
    )
    expect(isMeaningfulOptionalIdentityValue('')).toBe(false)
    expect(isMeaningfulOptionalIdentityValue('   ')).toBe(false)
    expect(isMeaningfulOptionalIdentityValue(null)).toBe(false)
    expect(isMeaningfulOptionalIdentityValue(undefined)).toBe(false)
    expect(isMeaningfulOptionalIdentityValue('Not set')).toBe(false)
    expect(isMeaningfulOptionalIdentityValue('n/a')).toBe(false)
    expect(
      getMeaningfulOptionalIdentityValue('', 'Not set', 'NorthStar Holdings'),
    ).toBe('NorthStar Holdings')
  })

  it('calculates line totals and order totals from current values', () => {
    expect(
      calculateOrderTotals({
        lines: [
          { quantity: 2, unitPrice: 10, discountTotal: 3, taxTotal: 1 },
          { quantity: 1, unitPrice: 5, discountTotal: 0, taxTotal: 0.5 },
        ],
        shippingTotal: 4,
      }),
    ).toEqual({
      subtotal: 25,
      discountTotal: 3,
      taxTotal: 1.5,
      shippingTotal: 4,
      total: 27.5,
    })
  })

  it('resolves percentage discounts before calculating line totals', () => {
    expect(
      calculateOrderTotals({
        lines: [
          {
            quantity: 2,
            unitPrice: 50,
            discountType: 'PERCENTAGE',
            discountValue: 10,
            taxTotal: 0,
          },
        ],
      }),
    ).toMatchObject({
      subtotal: 100,
      discountTotal: 10,
      total: 90,
    })
  })

  it('keeps KPI counts aligned with shared order views', () => {
    const orders = [
      order({ id: 'draft', orderNumber: 'ORD-01001', status: 'DRAFT' }),
      order({ id: 'open', orderNumber: 'ORD-01002', status: 'PROCESSING' }),
      order({
        id: 'completed',
        orderNumber: 'ORD-01003',
        status: 'COMPLETED',
        paymentStatus: 'PAID',
      }),
      order({
        id: 'archived',
        orderNumber: 'ORD-01004',
        archivedAt: '2026-01-02T00:00:00.000Z',
      }),
    ]
    const counts = selectOrderCounts(orders)
    expect(counts).toMatchObject({
      all: selectOrders(orders, customers, { view: 'all' }).length,
      draft: selectOrders(orders, customers, { view: 'draft' }).length,
      open: selectOrders(orders, customers, { view: 'open' }).length,
      completed: selectOrders(orders, customers, { view: 'completed' }).length,
      archived: selectOrders(orders, customers, { view: 'archived' }).length,
    })
    expect(counts.revenue).toBe(7.5)
  })

  it('filters and sorts orders by shipping responsibility and profitability', () => {
    const profitable = order({
      id: 'profitable',
      orderNumber: 'ORD-01010',
      shippingPayer: 'CUSTOMER',
      shippingCharge: 8,
      shippingCost: 4,
      lines: [
        {
          id: 'line-1',
          orderId: 'profitable',
          name: 'Known cost item',
          quantity: 1,
          unitPrice: 100,
          unitCost: 40,
          discountTotal: 0,
          taxTotal: 0,
          subtotal: 100,
          lineTotal: 100,
        },
      ],
    })
    const loss = order({
      id: 'loss',
      orderNumber: 'ORD-01011',
      shippingPayer: 'BUSINESS',
      shippingCharge: 0,
      shippingCost: 8,
      lines: [
        {
          id: 'line-2',
          orderId: 'loss',
          name: 'Loss item',
          quantity: 1,
          unitPrice: 10,
          unitCost: 12,
          discountTotal: 0,
          taxTotal: 0,
          subtotal: 10,
          lineTotal: 10,
        },
      ],
    })
    const missing = order({
      id: 'missing',
      orderNumber: 'ORD-01012',
      lines: [
        {
          id: 'line-3',
          orderId: 'missing',
          name: 'Missing cost item',
          quantity: 1,
          unitPrice: 50,
          discountTotal: 0,
          taxTotal: 0,
          subtotal: 50,
          lineTotal: 50,
        },
      ],
    })
    const orders = [loss, missing, profitable]

    expect(
      selectOrders(orders, customers, { shippingPayer: 'BUSINESS' }).map(
        (record) => record.id,
      ),
    ).toEqual(['loss'])
    expect(
      selectOrders(orders, customers, { profitability: 'PROFITABLE' }).map(
        (record) => record.id,
      ),
    ).toEqual(['profitable'])
    expect(
      selectOrders(orders, customers, { profitability: 'LOSS' }).map(
        (record) => record.id,
      ),
    ).toEqual(['loss'])
    expect(
      selectOrders(orders, customers, { profitability: 'MISSING_COST' }).map(
        (record) => record.id,
      ),
    ).toEqual(['missing'])
    expect(
      selectOrders(orders, customers, { sort: 'profit-desc' }).map(
        (record) => record.id,
      ),
    ).toEqual(['profitable', 'loss', 'missing'])
  })

  it('searches orders by order, customer, item, and sku', () => {
    const orders = [
      order({
        id: 'one',
        orderNumber: 'ORD-01001',
        customerId: 'customer-a',
        lines: [
          {
            id: 'line-1',
            orderId: 'one',
            name: 'Review Request Card',
            sku: 'CARD-001',
            quantity: 1,
            unitPrice: 2,
            discountTotal: 0,
            taxTotal: 0,
            subtotal: 2,
            lineTotal: 2,
          },
        ],
      }),
    ]
    expect(
      selectOrders(orders, customers, { query: 'northstar' }),
    ).toHaveLength(1)
    expect(selectOrders(orders, customers, { query: 'CARD-001' })).toHaveLength(
      1,
    )
    expect(
      selectOrders(orders, customers, { query: 'review request' }),
    ).toHaveLength(1)
  })

  it('validates customer and line-item requirements', () => {
    const result = validateOrderInput({
      input: { lines: [{ name: '', quantity: 0, unitPrice: -1 }] },
      customers,
      products: [],
      workspaceId: 'workspace-a',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.customer).toBe(
      'Select a customer or create one inline.',
    )
    expect(result.errors['lines.0.name']).toBe('Item name is required.')
    expect(result.errors['lines.0.quantity']).toBe(
      'Quantity must be greater than zero.',
    )
    expect(result.errors['lines.0.unitPrice']).toBe('Price cannot be negative.')
  })

  it('connects orders to commerce customers rather than CRM clients', () => {
    expect(
      getOrderCustomerLabel(order({ customerId: 'customer-a' }), customers),
    ).toBe('NorthStar Electric')
    expect(
      getOrderCustomerLabel(
        order({ customerSnapshot: { displayName: 'Guest' } }),
      ),
    ).toBe('Guest')
  })

  it('prepares preview inventory impact without executing fulfillment', () => {
    const products = [
      product({
        id: 'product-a',
        trackInventory: true,
        inventoryQuantity: 10,
      }),
    ]
    const impact = calculateOrderInventoryImpact({
      products,
      orders: [
        order({
          lines: [
            {
              id: 'line-1',
              orderId: 'order-1',
              productId: 'product-a',
              name: 'Energy Drink',
              quantity: 3,
              unitPrice: 4,
              discountTotal: 0,
              taxTotal: 0,
              subtotal: 12,
              lineTotal: 12,
            },
          ],
        }),
      ],
    })
    expect(impact[0]).toMatchObject({
      tracked: true,
      availableInventory: 10,
      reservedPreviewQuantity: 3,
      outgoingPreviewQuantity: 3,
      remainingPreviewQuantity: 7,
    })
  })

  it('normalizes and formats partial billing and shipping addresses', () => {
    const normalized = normalizeCommerceAddress({
      name: ' Jordan Lee ',
      company: '',
      line1: '123 Main Street',
      city: 'Richmond',
      region: 'VA',
      postalCode: '23220',
      country: 'United States',
      phone: ' +1 555 555 1234 ',
    })
    expect(normalized).toMatchObject({
      name: 'Jordan Lee',
      line1: '123 Main Street',
      city: 'Richmond',
      region: 'VA',
      postalCode: '23220',
      country: 'United States',
      phone: '+1 555 555 1234',
    })
    expect(formatCommerceAddressLines(normalized)).toEqual([
      'Jordan Lee',
      '123 Main Street',
      'Richmond, VA, 23220',
      'United States',
      '+1 555 555 1234',
    ])
    expect(formatCommerceAddress(undefined)).toBe('Not provided')
    expect(normalizeCommerceAddress({ line1: '   ' })).toBeUndefined()
  })

  it('uses billing as the effective shipping address when same-as-billing is enabled', () => {
    const sameAsBillingOrder = order({
      billingAddress: {
        line1: '123 Main Street',
        city: 'Richmond',
        postalCode: '23220',
        country: 'United States',
      },
      shippingAddress: {
        line1: '999 Warehouse Road',
        city: 'Norfolk',
        postalCode: '23510',
        country: 'United States',
      },
      shippingSameAsBilling: true,
    })
    expect(getEffectiveShippingAddress(sameAsBillingOrder)?.line1).toBe(
      '123 Main Street',
    )
    expect(
      getEffectiveShippingAddress(
        order({
          ...sameAsBillingOrder,
          shippingSameAsBilling: false,
        }),
      )?.line1,
    ).toBe('999 Warehouse Road')
  })

  it('calculates customer lifetime order count and paid spend from real orders', () => {
    const metrics = getCustomerOrderMetrics({
      customerId: 'customer-a',
      orders: [
        order({
          id: 'paid',
          customerId: 'customer-a',
          paymentStatus: 'PAID',
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
        order({
          id: 'unpaid',
          customerId: 'customer-a',
          paymentStatus: 'UNPAID',
          createdAt: '2026-01-03T00:00:00.000Z',
        }),
        order({
          id: 'archived',
          customerId: 'customer-a',
          archivedAt: '2026-01-04T00:00:00.000Z',
        }),
        order({
          id: 'cancelled',
          customerId: 'customer-a',
          status: 'CANCELLED',
        }),
      ],
    })
    expect(metrics).toEqual({
      customerSince: '2026-01-01T00:00:00.000Z',
      totalOrders: 2,
      lifetimeSpend: 7.5,
    })
  })

  it('creates readable item presentation for catalog variants and custom items', () => {
    const catalogProduct = product({
      id: 'product-with-variant',
      name: 'Review Cards',
      sku: 'CARD-PARENT',
      hasVariants: true,
      variants: [
        {
          id: 'variant-a',
          workspaceId: 'workspace-a',
          productId: 'product-with-variant',
          name: 'Blue Pack',
          optionValues: { Color: 'Blue', Size: 'Large' },
          sku: 'CARD-BLUE',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    expect(
      getOrderLinePresentation({
        products: [catalogProduct],
        line: {
          id: 'line-1',
          orderId: 'order-1',
          productId: 'product-with-variant',
          variantId: 'variant-a',
          name: 'Review Cards - Blue Pack',
          quantity: 2,
          unitPrice: 5,
          discountTotal: 0,
          taxTotal: 0,
          subtotal: 10,
          lineTotal: 10,
        },
      }),
    ).toMatchObject({
      productName: 'Review Cards',
      variantName: 'Blue Pack',
      sku: 'CARD-BLUE',
      isCustom: false,
      optionValues: ['Color: Blue', 'Size: Large'],
      subtotal: 10,
    })
    expect(
      getOrderLinePresentation({
        products: [],
        line: {
          id: 'line-2',
          orderId: 'order-1',
          name: 'Custom setup fee',
          quantity: 1,
          unitPrice: 30,
          discountTotal: 0,
          taxTotal: 0,
          subtotal: 30,
          lineTotal: 30,
        },
      }).isCustom,
    ).toBe(true)
  })
})
