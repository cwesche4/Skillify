import { describe, expect, it } from 'vitest'

import {
  selectFulfillmentCounts,
  selectFulfillmentRecords,
} from '@/lib/commerce/fulfillmentCatalog'
import { updateCommerceFulfillmentRecordStatus } from '@/lib/commerce/fulfillmentStatusTransitions'
import {
  createPreviewCustomer,
  createPreviewFulfillment,
  createPreviewOrder,
  createPreviewProduct,
  getPreviewFulfillmentActivities,
  getPreviewFulfillments,
  getPreviewOrders,
} from '@/lib/commerce/previewCommerceStorage'
import type { CommerceOrder, CommerceProduct } from '@/lib/commerce/types'

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

function seedProduct(workspaceId: string, storage: Storage): CommerceProduct {
  return createPreviewProduct({
    workspaceId,
    storage,
    input: {
      name: 'Maintenance Kit',
      status: 'ACTIVE',
      price: { amount: 125, currency: 'USD' },
      cost: { amount: 70, currency: 'USD' },
      taxable: true,
      trackInventory: true,
      inventoryQuantity: 10,
      hasVariants: false,
      variants: [],
    },
  }).product!
}

function seedOrder({
  workspaceId,
  storage,
  customerName = 'NorthStar Electric',
}: {
  workspaceId: string
  storage: Storage
  customerName?: string
}): CommerceOrder {
  const product = seedProduct(workspaceId, storage)
  const customer = createPreviewCustomer({
    workspaceId,
    storage,
    input: {
      displayName: customerName,
      email: `${customerName.toLowerCase().replace(/\W+/g, '')}@example.com`,
    },
  }).customer!
  return createPreviewOrder({
    workspaceId,
    storage,
    input: {
      customerId: customer.id,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED',
      shippingMethod: 'Ground',
      shippingCarrier: 'UPS',
      shippingCharge: 15,
      shippingCost: 10,
      shippingPayer: 'CUSTOMER',
      lines: [
        {
          productId: product.id,
          name: product.name,
          quantity: 2,
          unitPrice: 125,
          unitCost: 70,
        },
      ],
    },
  }).order!
}

describe('fulfillment foundation services', () => {
  it('creates fulfillment records from orders and writes a timeline entry', () => {
    const storage = new MemoryStorage()
    const order = seedOrder({ workspaceId: 'workspace-a', storage })

    const result = createPreviewFulfillment({
      workspaceId: 'workspace-a',
      storage,
      input: {
        orderId: order.id,
        priority: 'HIGH',
        assignedTo: 'Warehouse Team',
      },
    })

    expect(result.fulfillment?.fulfillmentNumber).toBe('FUL-01001')
    expect(result.fulfillment?.priority).toBe('HIGH')
    expect(result.fulfillment?.shippingMethod).toBe('Ground')
    expect(
      getPreviewFulfillmentActivities(
        'workspace-a',
        result.fulfillment!.id,
        storage,
      )[0],
    ).toMatchObject({
      title: 'Fulfillment created',
      description: order.orderNumber,
    })
  })

  it('filters and counts fulfillment records from one shared selector', () => {
    const storage = new MemoryStorage()
    const orderA = seedOrder({ workspaceId: 'workspace-a', storage })
    const orderB = seedOrder({
      workspaceId: 'workspace-a',
      storage,
      customerName: 'Bright Path Plumbing',
    })
    createPreviewFulfillment({
      workspaceId: 'workspace-a',
      storage,
      input: {
        orderId: orderA.id,
        priority: 'URGENT',
        assignedTo: 'Field Team',
      },
    })
    const second = createPreviewFulfillment({
      workspaceId: 'workspace-a',
      storage,
      input: { orderId: orderB.id, priority: 'LOW', assignedTo: 'Office Team' },
    }).fulfillment!
    updateCommerceFulfillmentRecordStatus({
      workspaceId: 'workspace-a',
      fulfillmentId: second.id,
      status: 'READY_TO_SHIP',
      storage,
    })

    const fulfillments = getPreviewFulfillments('workspace-a', storage)
    expect(selectFulfillmentCounts(fulfillments)).toMatchObject({
      all: 2,
      waiting: 1,
      ready: 1,
    })
    expect(
      selectFulfillmentRecords({
        fulfillments,
        orders: getPreviewOrders('workspace-a', storage),
        filters: { view: 'ready' },
      }),
    ).toHaveLength(1)
    expect(
      selectFulfillmentRecords({
        fulfillments,
        orders: getPreviewOrders('workspace-a', storage),
        filters: { query: 'Bright Path' },
      })[0]?.customerLabel,
    ).toBe('Bright Path Plumbing')
  })

  it('updates fulfillment status through the transition boundary', () => {
    const storage = new MemoryStorage()
    const order = seedOrder({ workspaceId: 'workspace-a', storage })
    const fulfillment = createPreviewFulfillment({
      workspaceId: 'workspace-a',
      storage,
      input: { orderId: order.id },
    }).fulfillment!

    const result = updateCommerceFulfillmentRecordStatus({
      workspaceId: 'workspace-a',
      fulfillmentId: fulfillment.id,
      status: 'DELIVERED',
      storage,
    })

    expect(result.fulfillment?.status).toBe('DELIVERED')
    expect(result.fulfillment?.deliveredAt).toBeTruthy()
    expect(
      getPreviewFulfillmentActivities(
        'workspace-a',
        fulfillment.id,
        storage,
      ).some((activity) => activity.title === 'Marked Delivered'),
    ).toBe(true)
    expect(getPreviewOrders('workspace-a', storage)[0]).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'DELIVERED',
    })
  })

  it('rejects invalid statuses and keeps fulfillments workspace isolated', () => {
    const storage = new MemoryStorage()
    const orderA = seedOrder({ workspaceId: 'workspace-a', storage })
    const orderB = seedOrder({ workspaceId: 'workspace-b', storage })
    const fulfillmentA = createPreviewFulfillment({
      workspaceId: 'workspace-a',
      storage,
      input: { orderId: orderA.id },
    }).fulfillment!
    createPreviewFulfillment({
      workspaceId: 'workspace-b',
      storage,
      input: { orderId: orderB.id },
    })

    const result = updateCommerceFulfillmentRecordStatus({
      workspaceId: 'workspace-a',
      fulfillmentId: fulfillmentA.id,
      status: 'PAID' as never,
      storage,
    })

    expect(result.fulfillment).toBeNull()
    expect(result.errors.status).toBe('Invalid fulfillment status.')
    expect(getPreviewFulfillments('workspace-a', storage)).toHaveLength(1)
    expect(getPreviewFulfillments('workspace-b', storage)).toHaveLength(1)
  })
})
