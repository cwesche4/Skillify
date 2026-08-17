import { describe, expect, it } from 'vitest'

import {
  archivePreviewProduct,
  archivePreviewOrder,
  cancelPreviewOrder,
  createEmptyCommercePreviewShape,
  createPreviewCustomer,
  createPreviewOrder,
  createPreviewProduct,
  duplicatePreviewProduct,
  duplicatePreviewOrder,
  getCommercePreviewStorageKey,
  getCommercePreviewSettingsStorageKey,
  getPreviewCustomers,
  getPreviewCommerceSettings,
  getPreviewOrders,
  getPreviewProducts,
  parseCommercePreviewRecords,
  readCommercePreviewRecords,
  restorePreviewProduct,
  savePreviewCommerceSettings,
  updatePreviewCustomer,
  updatePreviewOrder,
  updatePreviewProduct,
} from '@/lib/commerce/previewCommerceStorage'

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

describe('commerce preview storage foundation', () => {
  it('creates workspace-scoped storage keys', () => {
    expect(
      getCommercePreviewStorageKey({
        workspaceId: 'workspace-a',
        collection: 'orders',
      }),
    ).toBe('skillify-preview-commerce:workspace-a:orders:v1')
  })

  it('returns safe empty collections for malformed data', () => {
    expect(parseCommercePreviewRecords('{bad json', 'workspace-a')).toEqual([])
    expect(
      parseCommercePreviewRecords(
        JSON.stringify({
          version: 1,
          workspaceId: 'workspace-b',
          records: [{}],
        }),
        'workspace-a',
      ),
    ).toEqual([])
  })

  it('does not leak records across workspaces', () => {
    const storage = new Map<string, string>()
    storage.set(
      getCommercePreviewStorageKey({
        workspaceId: 'workspace-a',
        collection: 'customers',
      }),
      JSON.stringify({
        ...createEmptyCommercePreviewShape('workspace-a'),
        records: [{ id: 'customer-a', workspaceId: 'workspace-a' }],
      }),
    )

    expect(
      readCommercePreviewRecords({
        workspaceId: 'workspace-a',
        collection: 'customers',
        storage: { getItem: (key) => storage.get(key) ?? null },
      }),
    ).toHaveLength(1)
    expect(
      readCommercePreviewRecords({
        workspaceId: 'workspace-b',
        collection: 'customers',
        storage: { getItem: (key) => storage.get(key) ?? null },
      }),
    ).toEqual([])
  })

  it('stores workspace shipping defaults safely and recovers malformed settings', () => {
    const storage = new MemoryStorage()

    expect(
      getPreviewCommerceSettings('workspace-a', storage).shippingDefaults,
    ).toEqual({
      payer: 'CUSTOMER',
      method: undefined,
      carrier: undefined,
      shippingCharge: undefined,
      shippingCost: undefined,
    })

    savePreviewCommerceSettings({
      workspaceId: 'workspace-a',
      storage,
      settings: {
        workspaceId: 'workspace-a',
        shippingDefaults: {
          payer: 'BUSINESS',
          method: 'Ground',
          carrier: 'UPS',
          shippingCharge: 12,
          shippingCost: 8,
        },
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    expect(
      getPreviewCommerceSettings('workspace-a', storage).shippingDefaults,
    ).toEqual({
      payer: 'BUSINESS',
      method: 'Ground',
      carrier: 'UPS',
      shippingCharge: 12,
      shippingCost: 8,
    })
    expect(
      getPreviewCommerceSettings('workspace-b', storage).shippingDefaults.payer,
    ).toBe('CUSTOMER')

    storage.setItem(
      getCommercePreviewSettingsStorageKey('workspace-a'),
      '{bad json',
    )
    expect(
      getPreviewCommerceSettings('workspace-a', storage).shippingDefaults.payer,
    ).toBe('CUSTOMER')
  })

  it('creates, updates, archives, restores, and duplicates products', () => {
    const storage = new MemoryStorage()
    const created = createPreviewProduct({
      workspaceId: 'workspace-a',
      input: {
        name: 'Energy Drink',
        sku: 'ENERGY-001',
        price: { amount: 4, currency: 'USD' },
      },
      storage,
    }).product
    expect(created).toMatchObject({
      workspaceId: 'workspace-a',
      name: 'Energy Drink',
      status: 'DRAFT',
    })

    const updated = updatePreviewProduct({
      workspaceId: 'workspace-a',
      productId: created!.id,
      changes: { status: 'ACTIVE', cost: { amount: 1, currency: 'USD' } },
      storage,
    }).product
    expect(updated?.status).toBe('ACTIVE')
    expect(updated?.cost?.amount).toBe(1)

    expect(
      archivePreviewProduct({
        workspaceId: 'workspace-a',
        productId: created!.id,
        storage,
      }).product?.status,
    ).toBe('ARCHIVED')
    expect(
      restorePreviewProduct({
        workspaceId: 'workspace-a',
        productId: created!.id,
        storage,
      }).product?.status,
    ).toBe('DRAFT')

    const duplicate = duplicatePreviewProduct({
      workspaceId: 'workspace-a',
      productId: created!.id,
      storage,
    }).product
    expect(duplicate?.name).toBe('Energy Drink - Copy')
    expect(duplicate?.status).toBe('DRAFT')
    expect(duplicate?.sku).toBeUndefined()
  })

  it('isolates product records by workspace and recovers malformed storage', () => {
    const storage = new MemoryStorage()
    createPreviewProduct({
      workspaceId: 'workspace-a',
      input: {
        name: 'Workspace A Product',
        sku: 'SHARED',
        price: { amount: 1, currency: 'USD' },
      },
      storage,
    })
    expect(
      createPreviewProduct({
        workspaceId: 'workspace-b',
        input: {
          name: 'Workspace B Product',
          sku: 'SHARED',
          price: { amount: 1, currency: 'USD' },
        },
        storage,
      }).product,
    ).toBeTruthy()
    expect(getPreviewProducts('workspace-a', storage)).toHaveLength(1)
    expect(getPreviewProducts('workspace-b', storage)).toHaveLength(1)

    storage.setItem(
      getCommercePreviewStorageKey({
        workspaceId: 'workspace-a',
        collection: 'products',
      }),
      '{not-json',
    )
    expect(getPreviewProducts('workspace-a', storage)).toEqual([])
  })

  it('creates, updates, duplicates, archives, and cancels preview orders', () => {
    const storage = new MemoryStorage()
    const customer = createPreviewCustomer({
      workspaceId: 'workspace-a',
      input: {
        displayName: 'NorthStar Electric',
        email: 'owner@northstar.com',
      },
      storage,
    }).customer
    const product = createPreviewProduct({
      workspaceId: 'workspace-a',
      input: {
        name: 'Energy Drink',
        price: { amount: 4, currency: 'USD' },
      },
      storage,
    }).product

    const created = createPreviewOrder({
      workspaceId: 'workspace-a',
      input: {
        customerId: customer!.id,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        fulfillmentStatus: 'UNFULFILLED',
        lines: [
          {
            productId: product!.id,
            name: product!.name,
            quantity: 2,
            unitPrice: 4,
            unitCost: 1.5,
            discountTotal: 1,
            taxTotal: 0.5,
          },
        ],
        shippingCharge: 3,
        shippingCost: 2,
        shippingPayer: 'BUSINESS',
      },
      storage,
    }).order
    expect(created).toMatchObject({
      workspaceId: 'workspace-a',
      customerId: customer!.id,
      subtotal: 8,
      discountTotal: 1,
      taxTotal: 0.5,
      shippingTotal: 3,
      shippingCharge: 3,
      shippingCost: 2,
      shippingCostState: 'ESTIMATED',
      shippingPayer: 'BUSINESS',
      total: 10.5,
    })
    expect(created?.lines[0]?.unitCost).toBe(1.5)
    expect(created?.lines[0]).toMatchObject({
      discountType: 'FIXED_AMOUNT',
      discountValue: 1,
      resolvedDiscountAmount: 1,
    })

    const updated = updatePreviewOrder({
      workspaceId: 'workspace-a',
      orderId: created!.id,
      changes: { paymentStatus: 'PAID', fulfillmentStatus: 'PICKING' },
      storage,
    }).order
    expect(updated?.paymentStatus).toBe('PAID')
    expect(updated?.fulfillmentStatus).toBe('PICKING')

    const duplicate = duplicatePreviewOrder({
      workspaceId: 'workspace-a',
      orderId: created!.id,
      storage,
    }).order
    expect(duplicate?.status).toBe('DRAFT')
    expect(duplicate?.paymentStatus).toBe('UNPAID')
    expect(duplicate?.orderNumber).not.toBe(created?.orderNumber)

    expect(
      archivePreviewOrder({
        workspaceId: 'workspace-a',
        orderId: created!.id,
        storage,
      }).order?.archivedAt,
    ).toBeTruthy()
    expect(
      cancelPreviewOrder({
        workspaceId: 'workspace-a',
        orderId: duplicate!.id,
        storage,
      }).order?.status,
    ).toBe('CANCELLED')
  })

  it('keeps commerce customers and orders workspace scoped', () => {
    const storage = new MemoryStorage()
    const customerA = createPreviewCustomer({
      workspaceId: 'workspace-a',
      input: { displayName: 'Workspace A Customer' },
      storage,
    }).customer
    createPreviewOrder({
      workspaceId: 'workspace-a',
      input: {
        customerId: customerA!.id,
        lines: [{ name: 'A item', quantity: 1, unitPrice: 1 }],
      },
      storage,
    })
    createPreviewOrder({
      workspaceId: 'workspace-b',
      input: {
        inlineCustomer: { displayName: 'Workspace B Customer' },
        lines: [{ name: 'B item', quantity: 1, unitPrice: 1 }],
      },
      storage,
    })

    expect(getPreviewCustomers('workspace-a', storage)).toHaveLength(1)
    expect(getPreviewCustomers('workspace-b', storage)).toHaveLength(1)
    expect(getPreviewOrders('workspace-a', storage)).toHaveLength(1)
    expect(getPreviewOrders('workspace-b', storage)).toHaveLength(1)
  })

  it('updates shared customer notes separately from internal order notes', () => {
    const storage = new MemoryStorage()
    const customer = createPreviewCustomer({
      workspaceId: 'workspace-a',
      input: { displayName: 'NorthStar Electric' },
      storage,
    }).customer
    const order = createPreviewOrder({
      workspaceId: 'workspace-a',
      input: {
        customerId: customer!.id,
        lines: [{ name: 'Energy Drink', quantity: 1, unitPrice: 4 }],
      },
      storage,
    }).order

    updatePreviewCustomer({
      workspaceId: 'workspace-a',
      customerId: customer!.id,
      changes: { clientNotes: 'Leave at reception.' },
      storage,
    })
    updatePreviewOrder({
      workspaceId: 'workspace-a',
      orderId: order!.id,
      changes: { orderNotes: 'Pack with cold insert.' },
      storage,
    })

    expect(getPreviewCustomers('workspace-a', storage)[0]?.clientNotes).toBe(
      'Leave at reception.',
    )
    expect(getPreviewOrders('workspace-a', storage)[0]?.orderNotes).toBe(
      'Pack with cold insert.',
    )
  })

  it('loads legacy orders without addresses safely', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      getCommercePreviewStorageKey({
        workspaceId: 'workspace-a',
        collection: 'orders',
      }),
      JSON.stringify({
        ...createEmptyCommercePreviewShape('workspace-a'),
        records: [
          {
            id: 'legacy-order',
            workspaceId: 'workspace-a',
            orderNumber: 'ORD-09999',
            status: 'NEW',
            paymentStatus: 'AUTHORIZED',
            fulfillmentStatus: 'READY_TO_PICK',
            currency: 'USD',
            subtotal: 0,
            discountTotal: 0,
            taxTotal: 0,
            shippingTotal: 0,
            total: 0,
            lines: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    )

    const legacy = getPreviewOrders('workspace-a', storage)[0]
    expect(legacy).toMatchObject({
      status: 'PENDING',
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'PICKING',
      shippingSameAsBilling: false,
    })
    expect(legacy?.billingAddress).toBeUndefined()
    expect(legacy?.shippingAddress).toBeUndefined()
  })

  it('creates orders with partial billing and same-as-billing shipping addresses', () => {
    const storage = new MemoryStorage()
    const order = createPreviewOrder({
      workspaceId: 'workspace-a',
      input: {
        inlineCustomer: { displayName: 'NorthStar Electric' },
        billingAddress: {
          name: 'Jordan Lee',
          line1: '123 Main Street',
          city: 'Richmond',
          country: 'United States',
        },
        shippingAddress: {
          name: 'Jordan Lee',
          line1: '123 Main Street',
          city: 'Richmond',
          country: 'United States',
        },
        shippingSameAsBilling: true,
        shippingMethod: 'Ground',
        lines: [{ name: 'Energy Drink', quantity: 1, unitPrice: 4 }],
      },
      storage,
    }).order

    expect(order?.billingAddress).toMatchObject({
      name: 'Jordan Lee',
      line1: '123 Main Street',
      city: 'Richmond',
      country: 'United States',
    })
    expect(order?.shippingAddress?.line1).toBe('123 Main Street')
    expect(order?.shippingSameAsBilling).toBe(true)
    expect(order?.shippingMethod).toBe('Ground')
  })
})
