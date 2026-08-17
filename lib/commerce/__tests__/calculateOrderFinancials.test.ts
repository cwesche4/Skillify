import { describe, expect, it } from 'vitest'

import {
  calculateOrderFinancials,
  summarizeOrderFinancials,
} from '@/lib/commerce/calculateOrderFinancials'

describe('calculateOrderFinancials', () => {
  it('keeps customer-paid shipping revenue and equal business expense independent', () => {
    const result = calculateOrderFinancials({
      lines: [
        {
          quantity: 1,
          unitPrice: 60,
          unitCost: 12,
          discountTotal: 0,
          taxTotal: 0,
        },
      ],
      shippingCharge: 7.99,
      shippingCost: 7.99,
      shippingPayer: 'CUSTOMER',
    })

    expect(result).toMatchObject({
      merchandiseSubtotal: 60,
      merchandiseDiscounts: 0,
      merchandiseRevenue: 60,
      shippingRevenue: 7.99,
      totalOrderRevenue: 67.99,
      customerTotal: 67.99,
      costOfGoodsSold: 12,
      shippingExpense: 7.99,
      totalCost: 19.99,
      merchandiseGrossProfit: 48,
      orderGrossProfit: 48,
      merchandiseMarginPercent: 80,
      orderMarginPercent: 70.6,
      profitabilityComplete: true,
    })
  })

  it('subtracts business-paid free shipping from full-order profit', () => {
    const result = calculateOrderFinancials({
      lines: [{ quantity: 1, unitPrice: 60, unitCost: 12 }],
      shippingCharge: 0,
      shippingCost: 7.99,
      shippingPayer: 'BUSINESS',
    })

    expect(result.totalOrderRevenue).toBe(60)
    expect(result.orderGrossProfit).toBe(40.01)
    expect(result.orderMarginPercent).toBe(66.7)
  })

  it('retains shipping spread when customer charge exceeds business cost', () => {
    const result = calculateOrderFinancials({
      lines: [{ quantity: 1, unitPrice: 60, unitCost: 12 }],
      shippingCharge: 7.99,
      shippingCost: 5,
    })

    expect(result.totalOrderRevenue).toBe(67.99)
    expect(result.orderGrossProfit).toBe(50.99)
  })

  it('excludes tax from revenue and profit while keeping it in customer total', () => {
    const result = calculateOrderFinancials({
      lines: [{ quantity: 1, unitPrice: 50, unitCost: 20, taxTotal: 5 }],
      shippingCharge: 10,
      shippingCost: 4,
    })

    expect(result.totalOrderRevenue).toBe(60)
    expect(result.customerTotal).toBe(65)
    expect(result.orderGrossProfit).toBe(36)
  })

  it('supports fixed and percentage discounts and caps line discount at subtotal', () => {
    const fixed = calculateOrderFinancials({
      lines: [
        {
          quantity: 2,
          unitPrice: 50,
          unitCost: 10,
          discountType: 'FIXED_AMOUNT',
          discountValue: 15,
        },
      ],
    })
    const percentage = calculateOrderFinancials({
      lines: [
        {
          quantity: 2,
          unitPrice: 50,
          unitCost: 10,
          discountType: 'PERCENTAGE',
          discountValue: 12.5,
        },
      ],
    })
    const capped = calculateOrderFinancials({
      lines: [
        {
          quantity: 1,
          unitPrice: 20,
          unitCost: 5,
          discountType: 'FIXED_AMOUNT',
          discountValue: 50,
        },
      ],
    })

    expect(fixed.merchandiseRevenue).toBe(85)
    expect(percentage.merchandiseDiscounts).toBe(12.5)
    expect(percentage.merchandiseRevenue).toBe(87.5)
    expect(capped.merchandiseRevenue).toBe(0)
    expect(capped.customerTotal).toBe(0)
  })

  it('uses variant cost override before product cost and handles multi-line orders', () => {
    const result = calculateOrderFinancials({
      products: [
        {
          id: 'product-a',
          workspaceId: 'workspace-a',
          name: 'Base product',
          status: 'ACTIVE',
          price: { amount: 30, currency: 'USD' },
          cost: { amount: 20, currency: 'USD' },
          taxable: true,
          trackInventory: false,
          hasVariants: true,
          variants: [
            {
              id: 'variant-a',
              workspaceId: 'workspace-a',
              productId: 'product-a',
              name: 'Small',
              optionValues: {},
              status: 'ACTIVE',
              cost: { amount: 8, currency: 'USD' },
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      lines: [
        {
          productId: 'product-a',
          variantId: 'variant-a',
          quantity: 2,
          unitPrice: 30,
        },
        { quantity: 1, unitPrice: 40, unitCost: 15 },
      ],
      shippingCharge: 5,
      shippingCost: 4,
    })

    expect(result.costOfGoodsSold).toBe(31)
    expect(result.totalOrderRevenue).toBe(105)
    expect(result.orderGrossProfit).toBe(70)
  })

  it('returns unavailable margins when revenue is zero', () => {
    const result = calculateOrderFinancials({
      lines: [{ quantity: 0, unitPrice: 0, unitCost: 0 }],
    })

    expect(result.merchandiseMarginPercent).toBeNull()
    expect(result.orderMarginPercent).toBeNull()
  })

  it('marks profitability incomplete when product costs are missing', () => {
    const result = calculateOrderFinancials({
      lines: [{ quantity: 1, unitPrice: 30, discountTotal: 0, taxTotal: 0 }],
      shippingCharge: 5,
      shippingCost: 3,
    })

    expect(result.profitabilityComplete).toBe(false)
    expect(result.missingCostCount).toBe(1)
    expect(result.totalCost).toBeNull()
    expect(result.orderGrossProfit).toBeNull()
    expect(result.orderMarginPercent).toBeNull()
  })

  it('summarizes order financials without treating incomplete profit as zero', () => {
    const summary = summarizeOrderFinancials([
      {
        id: 'order-a',
        workspaceId: 'workspace-a',
        orderNumber: 'ORD-1',
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'DELIVERED',
        currency: 'USD',
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 10,
        shippingCharge: 10,
        shippingCost: 5,
        shippingPayer: 'CUSTOMER',
        total: 110,
        shippingSameAsBilling: true,
        source: 'MANUAL',
        lines: [
          {
            id: 'line-a',
            orderId: 'order-a',
            name: 'Known cost',
            quantity: 1,
            unitPrice: 100,
            unitCost: 40,
            discountTotal: 0,
            taxTotal: 0,
            subtotal: 100,
            lineTotal: 100,
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'order-b',
        workspaceId: 'workspace-a',
        orderNumber: 'ORD-2',
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'DELIVERED',
        currency: 'USD',
        subtotal: 30,
        discountTotal: 0,
        taxTotal: 0,
        shippingTotal: 0,
        shippingCharge: 0,
        shippingPayer: 'CUSTOMER',
        total: 30,
        shippingSameAsBilling: true,
        source: 'MANUAL',
        lines: [
          {
            id: 'line-b',
            orderId: 'order-b',
            name: 'Missing cost',
            quantity: 1,
            unitPrice: 30,
            discountTotal: 0,
            taxTotal: 0,
            subtotal: 30,
            lineTotal: 30,
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ])

    expect(summary.revenue).toBe(140)
    expect(summary.knownGrossProfit).toBe(65)
    expect(summary.grossProfit).toBeNull()
    expect(summary.orderGrossProfit).toBeNull()
    expect(summary.incompleteOrderCount).toBe(1)
  })
})
