import { describe, expect, it } from 'vitest'

import {
  COMMERCE_AUTOMATION_EVENTS,
  COMMERCE_FULFILLMENT_STATUS_ORDER,
  COMMERCE_INVENTORY_STATE_OPTIONS,
  COMMERCE_MODULES,
  COMMERCE_ORDER_STATUS_ORDER,
  COMMERCE_PAYMENT_STATUS_ORDER,
  COMMERCE_PRODUCT_EVENT_LABELS,
  COMMERCE_PRODUCT_STATUS_OPTIONS,
  COMMERCE_PRODUCT_TABLE_COLUMNS,
  COMMERCE_PRODUCT_VARIANT_LIMITS,
  DEFAULT_COMMERCE_TERMINOLOGY,
  getCommerceModule,
  getCommerceStatusLabel,
  getVisibleCommerceModules,
} from '@/lib/commerce/commerceRegistry'

describe('commerce registry foundation', () => {
  it('keeps commerce terminology centralized', () => {
    expect(DEFAULT_COMMERCE_TERMINOLOGY.customerPlural).toBe('Customers')
    expect(DEFAULT_COMMERCE_TERMINOLOGY.productPlural).toBe('Products')
    expect(DEFAULT_COMMERCE_TERMINOLOGY.orderPlural).toBe('Orders')
    expect(DEFAULT_COMMERCE_TERMINOLOGY.fulfillmentPlural).toBe('Fulfillment')
  })

  it('exposes only foundation modules in navigation', () => {
    expect(getVisibleCommerceModules().map((module) => module.id)).toEqual([
      'customers',
      'products',
      'orders',
      'fulfillment',
    ])
    expect(
      COMMERCE_MODULES.find((module) => module.id === 'inventory')?.status,
    ).toBe('HIDDEN')
  })

  it('keeps order, payment, and fulfillment statuses separate', () => {
    expect(COMMERCE_ORDER_STATUS_ORDER).toContain('DRAFT')
    expect(COMMERCE_ORDER_STATUS_ORDER).toContain('CONFIRMED')
    expect(COMMERCE_PAYMENT_STATUS_ORDER).toContain('UNPAID')
    expect(COMMERCE_FULFILLMENT_STATUS_ORDER).toContain('READY_TO_SHIP')
    expect(COMMERCE_ORDER_STATUS_ORDER).not.toContain('PAID')
    expect(COMMERCE_PAYMENT_STATUS_ORDER).not.toContain('SHIPPED')
    expect(COMMERCE_FULFILLMENT_STATUS_ORDER).not.toContain('REFUNDED')
    expect(getCommerceStatusLabel('READY_TO_SHIP')).toBe('Ready to Ship')
  })

  it('fails safely for unknown module and status lookups', () => {
    expect(getCommerceModule('products')).toMatchObject({ label: 'Products' })
    expect(getCommerceStatusLabel('UNKNOWN')).toBe('UNKNOWN')
  })

  it('prepares commerce automation events without execution behavior', () => {
    expect(COMMERCE_AUTOMATION_EVENTS).toContain('order.created')
    expect(COMMERCE_AUTOMATION_EVENTS).toContain('fulfillment.delivered')
    expect(COMMERCE_AUTOMATION_EVENTS).toContain('product.archived')
    expect(COMMERCE_AUTOMATION_EVENTS).toContain('product.variant_removed')
    expect(COMMERCE_PRODUCT_EVENT_LABELS['product.price_changed']).toBe(
      'Price updated',
    )
  })

  it('centralizes product catalog registry options', () => {
    expect(
      COMMERCE_PRODUCT_STATUS_OPTIONS.map((option) => option.label),
    ).toEqual(['Draft', 'Active', 'Archived'])
    expect(
      COMMERCE_INVENTORY_STATE_OPTIONS.map((option) => option.value),
    ).toContain('LOW_STOCK')
    expect(COMMERCE_PRODUCT_TABLE_COLUMNS.map((column) => column.id)).toEqual([
      'product',
      'status',
      'sku',
      'category',
      'price',
      'cost',
      'margin',
      'inventory',
      'updated',
    ])
    expect(COMMERCE_PRODUCT_VARIANT_LIMITS.maxVariants).toBe(100)
  })
})
