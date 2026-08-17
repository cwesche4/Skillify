import { describe, expect, it } from 'vitest'

import {
  buildCustomerRecord,
  isReturningCustomer,
  selectCustomerCounts,
  selectCustomerRecords,
} from '@/lib/commerce/customerCatalog'
import {
  COMMERCE_CUSTOMER_STATUS_OPTIONS,
  COMMERCE_CUSTOMER_TYPE_OPTIONS,
} from '@/lib/commerce/commerceRegistry'
import { createDefaultCustomerTypes } from '@/lib/commerce/customerTypeRegistry'
import {
  normalizePreviewCustomer,
  normalizePreviewFulfillment,
  normalizePreviewOrder,
  normalizePreviewProduct,
} from '@/lib/commerce/previewCommerceStorage'

const workspaceId = 'customer-catalog-workspace'
const now = '2026-01-01T00:00:00.000Z'
const customerTypes = createDefaultCustomerTypes({ workspaceId, now })
const commercialType = customerTypes.find((type) => type.name === 'Commercial')!

function customer(input: Parameters<typeof normalizePreviewCustomer>[0]) {
  return normalizePreviewCustomer(
    {
      id: input.id ?? 'customer-a',
      workspaceId,
      displayName: input.displayName ?? 'NorthStar Electric',
      lifecycleStatus: input.lifecycleStatus ?? 'ACTIVE',
      createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
      updatedAt: input.updatedAt ?? '2026-01-01T00:00:00.000Z',
      ...input,
    },
    workspaceId,
  )
}

function order(input: Parameters<typeof normalizePreviewOrder>[0]) {
  const total = Number(input.total ?? 500)
  return normalizePreviewOrder(
    {
      id: input.id ?? 'order-a',
      workspaceId,
      orderNumber: input.orderNumber ?? 'ORD-01001',
      customerId: input.customerId ?? 'customer-a',
      status: input.status ?? 'COMPLETED',
      paymentStatus: input.paymentStatus ?? 'PAID',
      fulfillmentStatus: input.fulfillmentStatus ?? 'DELIVERED',
      currency: 'USD',
      lines: input.lines ?? [
        {
          id: 'line-a',
          orderId: input.id ?? 'order-a',
          productId: 'product-a',
          name: 'Maintenance Kit',
          quantity: 1,
          unitPrice: total,
          discountTotal: 0,
          taxTotal: 0,
          subtotal: total,
          lineTotal: total,
        },
      ],
      createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
      updatedAt: input.updatedAt ?? '2026-01-01T00:00:00.000Z',
      ...input,
    },
    workspaceId,
  )
}

function product() {
  return normalizePreviewProduct(
    {
      id: 'product-a',
      workspaceId,
      name: 'Maintenance Kit',
      status: 'ACTIVE',
      price: { amount: 500, currency: 'USD' },
      taxable: true,
      trackInventory: true,
      inventoryQuantity: 5,
      hasVariants: false,
      variants: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    workspaceId,
  )
}

describe('commerce customer catalog selectors', () => {
  it('keeps customer status and type registries distinct', () => {
    expect(
      COMMERCE_CUSTOMER_STATUS_OPTIONS.map((option) => option.label),
    ).toEqual(['New', 'Active', 'At Risk', 'Inactive'])
    expect(
      COMMERCE_CUSTOMER_TYPE_OPTIONS.map((option) => option.label),
    ).toEqual([
      'Residential',
      'Commercial',
      'Retail',
      'Wholesale',
      'Distributor',
      'Government',
      'Nonprofit',
      'Employee',
      'Internal',
    ])
    const statusValues = new Set(
      COMMERCE_CUSTOMER_STATUS_OPTIONS.map((option) => option.value),
    )
    expect(
      COMMERCE_CUSTOMER_TYPE_OPTIONS.some((option) =>
        statusValues.has(option.value as never),
      ),
    ).toBe(false)
  })

  it('calculates customer metrics and connected products', () => {
    const customers = [customer({ id: 'customer-a' })]
    const orders = [
      order({ id: 'order-a', total: 500 }),
      order({ id: 'order-b', orderNumber: 'ORD-01002', total: 1200 }),
    ]
    const fulfillments = [
      normalizePreviewFulfillment(
        {
          id: 'ful-a',
          workspaceId,
          fulfillmentNumber: 'FUL-01001',
          orderId: 'order-a',
          customerId: 'customer-a',
          status: 'DELIVERED',
          priority: 'MEDIUM',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        workspaceId,
      ),
    ]
    const record = buildCustomerRecord({
      customer: customers[0]!,
      orders,
      fulfillments,
      products: [product()],
    })

    expect(record.metrics.totalOrders).toBe(2)
    expect(record.metrics.lifetimeRevenue).toBe(1700)
    expect(record.metrics.averageOrderValue).toBe(850)
    expect(record.metrics.largestOrder).toBe(1200)
    expect(record.metrics.productsPurchased).toBe(1)
    expect(record.metrics.fulfilledCount).toBe(1)
    expect(isReturningCustomer(record.metrics)).toBe(true)
  })

  it('keeps counts and filters on the same customer record source', () => {
    const customers = [
      customer({ id: 'new', displayName: 'New Buyer', lifecycleStatus: 'NEW' }),
      customer({
        id: 'vip',
        displayName: 'VIP Buyer',
        lifecycleStatus: 'ACTIVE',
        tags: ['VIP'],
      }),
      customer({
        id: 'inactive',
        displayName: 'Inactive Buyer',
        lifecycleStatus: 'INACTIVE',
        archivedAt: '2026-01-02T00:00:00.000Z',
      }),
    ]
    const orders = [order({ customerId: 'vip', total: 1500 })]
    const counts = selectCustomerCounts({
      customers,
      orders,
      fulfillments: [],
      products: [product()],
    })

    expect(counts.all).toBe(3)
    expect(counts.vip).toBe(1)
    expect(counts.inactive).toBe(1)
    expect(counts.highValue).toBe(1)
    expect(
      selectCustomerRecords({
        customers,
        orders,
        fulfillments: [],
        products: [product()],
        filters: { view: 'highValue' },
      }).map((row) => row.customer.id),
    ).toEqual(['vip'])
  })

  it('derives returning and VIP segments without status/type overlap', () => {
    const customers = [
      customer({ id: 'returning', lifecycleStatus: 'ACTIVE' }),
      customer({
        id: 'vip',
        displayName: 'VIP Buyer',
        lifecycleStatus: 'ACTIVE',
        tags: ['VIP'],
      }),
      customer({ id: 'commercial', customerTypeId: commercialType.id }),
    ]
    const orders = [
      order({ id: 'order-1', customerId: 'returning', total: 100 }),
      order({
        id: 'order-2',
        orderNumber: 'ORD-01002',
        customerId: 'returning',
        total: 200,
      }),
    ]

    expect(
      selectCustomerRecords({
        customers,
        orders,
        fulfillments: [],
        products: [],
        filters: { view: 'returning' },
      }).map((row) => row.customer.id),
    ).toEqual(['returning'])
    expect(
      selectCustomerRecords({
        customers,
        orders: [],
        fulfillments: [],
        products: [],
        filters: { view: 'vip' },
      }).map((row) => row.customer.id),
    ).toEqual(['vip'])
    expect(
      selectCustomerRecords({
        customers,
        orders: [],
        fulfillments: [],
        products: [],
        customerTypes,
        filters: { customerType: commercialType.id },
      }).map((row) => row.customer.id),
    ).toEqual(['commercial'])
  })
})
