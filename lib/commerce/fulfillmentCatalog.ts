import type {
  CommerceCustomer,
  CommerceFulfillment,
  CommerceFulfillmentPriority,
  CommerceFulfillmentStatus,
  CommerceOrder,
  CommerceOrderLine,
  CommerceProduct,
} from '@/lib/commerce/types'
import { getCommerceStatusLabel } from '@/lib/commerce/commerceRegistry'
import {
  getOrderCustomerLabel,
  getOrderLinePresentation,
} from '@/lib/commerce/orderCatalog'

export type FulfillmentViewKey =
  | 'all'
  | 'waiting'
  | 'inProgress'
  | 'ready'
  | 'completed'

export type FulfillmentFilters = {
  view?: FulfillmentViewKey
  query?: string
  status?: 'ALL' | CommerceFulfillmentStatus
  priority?: 'ALL' | CommerceFulfillmentPriority
  assignedTo?: 'ALL' | string
  shippingMethod?: 'ALL' | string
  carrier?: 'ALL' | string
}

export type FulfillmentLinePresentation = {
  line: CommerceOrderLine
  productName: string
  variantName: string | null
  sku: string
  qtyOrdered: number
  qtyFulfilled: number
  qtyRemaining: number
}

export type FulfillmentRecord = {
  fulfillment: CommerceFulfillment
  order: CommerceOrder | null
  customer: CommerceCustomer | null
  customerLabel: string
  items: FulfillmentLinePresentation[]
}

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function isFulfillmentInProgress(fulfillment: CommerceFulfillment) {
  return ['PICKING', 'PACKING', 'SHIPPED'].includes(fulfillment.status)
}

export function isFulfillmentCompleted(fulfillment: CommerceFulfillment) {
  return ['DELIVERED', 'RETURNED', 'CANCELLED'].includes(fulfillment.status)
}

export function selectFulfillmentCounts(fulfillments: CommerceFulfillment[]) {
  return {
    all: fulfillments.length,
    waiting: fulfillments.filter((record) => record.status === 'UNFULFILLED')
      .length,
    inProgress: fulfillments.filter(isFulfillmentInProgress).length,
    ready: fulfillments.filter((record) => record.status === 'READY_TO_SHIP')
      .length,
    completed: fulfillments.filter(isFulfillmentCompleted).length,
  }
}

export function getFulfillmentCustomer({
  fulfillment,
  order,
  customers,
}: {
  fulfillment: CommerceFulfillment
  order: CommerceOrder | null
  customers: CommerceCustomer[]
}) {
  const customerId = fulfillment.customerId ?? order?.customerId
  return customerId
    ? (customers.find((customer) => customer.id === customerId) ?? null)
    : null
}

export function getFulfillmentItems({
  order,
  products,
}: {
  order: CommerceOrder | null
  products: CommerceProduct[]
}): FulfillmentLinePresentation[] {
  if (!order) return []
  return order.lines.map((line) => {
    const item = getOrderLinePresentation({ line, products })
    const qtyFulfilled =
      order.fulfillmentStatus === 'DELIVERED' ? line.quantity : 0
    return {
      line,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      qtyOrdered: line.quantity,
      qtyFulfilled,
      qtyRemaining: Math.max(0, line.quantity - qtyFulfilled),
    }
  })
}

export function buildFulfillmentRecord({
  fulfillment,
  orders,
  customers,
  products,
}: {
  fulfillment: CommerceFulfillment
  orders: CommerceOrder[]
  customers: CommerceCustomer[]
  products: CommerceProduct[]
}): FulfillmentRecord {
  const order =
    orders.find((record) => record.id === fulfillment.orderId) ?? null
  const customer = getFulfillmentCustomer({ fulfillment, order, customers })
  return {
    fulfillment,
    order,
    customer,
    customerLabel: order
      ? getOrderCustomerLabel(order, customers)
      : (customer?.displayName ?? 'Customer unavailable'),
    items: getFulfillmentItems({ order, products }),
  }
}

export function selectFulfillmentRecords({
  fulfillments,
  orders,
  customers,
  products,
  filters = {},
}: {
  fulfillments: CommerceFulfillment[]
  orders: CommerceOrder[]
  customers?: CommerceCustomer[]
  products?: CommerceProduct[]
  filters?: FulfillmentFilters
}) {
  const query = normalize(filters.query)
  let records = fulfillments.map((fulfillment) =>
    buildFulfillmentRecord({
      fulfillment,
      orders,
      customers: customers ?? [],
      products: products ?? [],
    }),
  )

  const view = filters.view ?? 'all'
  if (view === 'waiting') {
    records = records.filter(
      (record) => record.fulfillment.status === 'UNFULFILLED',
    )
  }
  if (view === 'inProgress') {
    records = records.filter((record) =>
      isFulfillmentInProgress(record.fulfillment),
    )
  }
  if (view === 'ready') {
    records = records.filter(
      (record) => record.fulfillment.status === 'READY_TO_SHIP',
    )
  }
  if (view === 'completed') {
    records = records.filter((record) =>
      isFulfillmentCompleted(record.fulfillment),
    )
  }
  if (filters.status && filters.status !== 'ALL') {
    records = records.filter(
      (record) => record.fulfillment.status === filters.status,
    )
  }
  if (filters.priority && filters.priority !== 'ALL') {
    records = records.filter(
      (record) => record.fulfillment.priority === filters.priority,
    )
  }
  if (filters.assignedTo && filters.assignedTo !== 'ALL') {
    records = records.filter(
      (record) => record.fulfillment.assignedTo === filters.assignedTo,
    )
  }
  if (filters.shippingMethod && filters.shippingMethod !== 'ALL') {
    records = records.filter(
      (record) =>
        normalize(
          record.fulfillment.shippingMethod ?? record.order?.shippingMethod,
        ) === normalize(filters.shippingMethod),
    )
  }
  if (filters.carrier && filters.carrier !== 'ALL') {
    records = records.filter(
      (record) =>
        normalize(
          record.fulfillment.carrier ?? record.order?.shippingCarrier,
        ) === normalize(filters.carrier),
    )
  }
  if (query) {
    records = records.filter((record) => {
      const values = [
        record.fulfillment.fulfillmentNumber,
        record.order?.orderNumber,
        record.customerLabel,
        record.fulfillment.trackingNumber,
        record.fulfillment.carrier,
        record.order?.shippingCarrier,
        ...record.items.flatMap((item) => [
          item.productName,
          item.variantName,
          item.sku,
        ]),
      ]
      return values.some((value) => normalize(value).includes(query))
    })
  }

  return records.sort(
    (first, second) =>
      new Date(second.fulfillment.updatedAt).getTime() -
      new Date(first.fulfillment.updatedAt).getTime(),
  )
}

export function getFulfillmentStatusChart(fulfillments: CommerceFulfillment[]) {
  const counts = fulfillments.reduce<Record<string, number>>(
    (acc, fulfillment) => {
      const label = getCommerceStatusLabel(fulfillment.status)
      acc[label] = (acc[label] ?? 0) + 1
      return acc
    },
    {},
  )
  return Object.entries(counts).map(([label, value]) => ({ label, value }))
}
