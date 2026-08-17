import { describe, expect, it } from 'vitest'

import { calculateOrderFinancialsFromOrder } from '@/lib/commerce/calculateOrderFinancials'
import {
  createPreviewCustomer,
  createPreviewOrder,
  createPreviewProduct,
  getPreviewOrderActivities,
  getPreviewOrders,
  createPreviewFulfillment,
  getPreviewFulfillments,
} from '@/lib/commerce/previewCommerceStorage'
import {
  updateCommerceFulfillmentStatus,
  updateCommerceOrderStatus,
  updateCommerceOrderQuickStatuses,
  updateCommercePaymentStatus,
} from '@/lib/commerce/orderStatusTransitions'
import type { CommerceOrderStatus } from '@/lib/commerce/types'

class MemoryStorage implements Storage {
  private records = new Map<string, string>()
  get length() {
    return this.records.size
  }
  clear() {
    this.records.clear()
  }
  getItem(key: string) {
    return this.records.get(key) ?? null
  }
  key(index: number) {
    return Array.from(this.records.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.records.delete(key)
  }
  setItem(key: string, value: string) {
    this.records.set(key, value)
  }
}

function seedOrder({
  workspaceId = 'workspace-status-a',
  storage,
}: {
  workspaceId?: string
  storage: Storage
}) {
  const product = createPreviewProduct({
    workspaceId,
    input: {
      name: 'Service Plan',
      status: 'ACTIVE',
      price: { amount: 60, currency: 'USD' },
      cost: { amount: 12, currency: 'USD' },
      taxable: true,
      trackInventory: false,
      hasVariants: false,
    },
    storage,
  }).product!
  const customer = createPreviewCustomer({
    workspaceId,
    input: { displayName: 'NorthStar Electric' },
    storage,
  }).customer!
  const order = createPreviewOrder({
    workspaceId,
    input: {
      customerId: customer.id,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'UNFULFILLED',
      shippingCharge: 7.99,
      shippingCost: 7.99,
      shippingPayer: 'CUSTOMER',
      lines: [
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: 60,
          unitCost: 12,
        },
      ],
    },
    storage,
  }).order!
  return { order, product }
}

describe('commerce order status transitions', () => {
  it('persists an order status change and writes exactly one timeline activity', () => {
    const storage = new MemoryStorage()
    const { order } = seedOrder({ storage })

    const result = updateCommerceOrderStatus({
      workspaceId: order.workspaceId,
      orderId: order.id,
      status: 'CONFIRMED',
      storage,
    })

    expect(result.order?.status).toBe('CONFIRMED')
    expect(getPreviewOrders(order.workspaceId, storage)[0]?.status).toBe(
      'CONFIRMED',
    )
    const activities = getPreviewOrderActivities(
      order.workspaceId,
      order.id,
      storage,
    )
    const statusActivities = activities.filter(
      (activity) => activity.title === 'Order status updated',
    )
    expect(activities).toHaveLength(2)
    expect(statusActivities).toHaveLength(1)
    expect(statusActivities[0]).toMatchObject({
      title: 'Order status updated',
      description: 'Pending → Confirmed',
    })
  })

  it('rejects invalid cross-domain status values', () => {
    const storage = new MemoryStorage()
    const { order } = seedOrder({ storage })

    const result = updateCommerceOrderStatus({
      workspaceId: order.workspaceId,
      orderId: order.id,
      status: 'PAID' as CommerceOrderStatus,
      storage,
    })

    expect(result.order).toBeNull()
    expect(result.errors.status).toBe('Invalid order status.')
    expect(getPreviewOrders(order.workspaceId, storage)[0]?.status).toBe(
      'PENDING',
    )
  })

  it('does not alter financial totals when payment status changes', () => {
    const storage = new MemoryStorage()
    const { order, product } = seedOrder({ storage })
    const before = calculateOrderFinancialsFromOrder(order, [product])

    const result = updateCommercePaymentStatus({
      workspaceId: order.workspaceId,
      orderId: order.id,
      status: 'PAID',
      storage,
    })
    const after = calculateOrderFinancialsFromOrder(result.order!, [product])

    expect(after.customerTotal).toBe(before.customerTotal)
    expect(after.orderGrossProfit).toBe(before.orderGrossProfit)
    expect(after.orderMarginPercent).toBe(before.orderMarginPercent)
  })

  it('keeps status transitions workspace isolated', () => {
    const storage = new MemoryStorage()
    const first = seedOrder({
      workspaceId: 'workspace-status-a',
      storage,
    }).order
    const second = seedOrder({
      workspaceId: 'workspace-status-b',
      storage,
    }).order

    updateCommerceOrderStatus({
      workspaceId: first.workspaceId,
      orderId: first.id,
      status: 'COMPLETED',
      storage,
    })

    expect(getPreviewOrders(first.workspaceId, storage)[0]?.status).toBe(
      'COMPLETED',
    )
    expect(getPreviewOrders(second.workspaceId, storage)[0]?.status).toBe(
      'PENDING',
    )
  })

  it('saves quick status drafts together and only writes changed activities', () => {
    const storage = new MemoryStorage()
    const { order } = seedOrder({ storage })

    const result = updateCommerceOrderQuickStatuses({
      workspaceId: order.workspaceId,
      orderId: order.id,
      statuses: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'UNFULFILLED',
      },
      storage,
    })

    expect(result.order).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED',
    })
    const activities = getPreviewOrderActivities(
      order.workspaceId,
      order.id,
      storage,
    )
    expect(
      activities.filter(
        (activity) => activity.title === 'Order status updated',
      ),
    ).toHaveLength(1)
    expect(
      activities.filter(
        (activity) => activity.title === 'Payment status updated',
      ),
    ).toHaveLength(1)
    expect(
      activities.filter(
        (activity) => activity.title === 'Fulfillment status updated',
      ),
    ).toHaveLength(0)
  })

  it('syncs order fulfillment status to exactly one active fulfillment without changing other domains', () => {
    const storage = new MemoryStorage()
    const { order } = seedOrder({ storage })
    const fulfillment = createPreviewFulfillment({
      workspaceId: order.workspaceId,
      input: { orderId: order.id },
      storage,
    }).fulfillment!

    updateCommerceFulfillmentStatus({
      workspaceId: order.workspaceId,
      orderId: order.id,
      status: 'PACKING',
      storage,
    })

    const [updatedFulfillment] = getPreviewFulfillments(
      order.workspaceId,
      storage,
    )
    const [updatedOrder] = getPreviewOrders(order.workspaceId, storage)
    expect(updatedFulfillment.id).toBe(fulfillment.id)
    expect(updatedFulfillment.status).toBe('PACKING')
    expect(updatedOrder.status).toBe('PENDING')
    expect(updatedOrder.paymentStatus).toBe('UNPAID')
    expect(updatedOrder.fulfillmentStatus).toBe('PACKING')
  })
})
