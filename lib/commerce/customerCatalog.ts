import type {
  CommerceCustomer,
  CommerceCustomerStatus,
  CommerceCustomerTag,
  CommerceCustomerTypeDefinition,
  CommerceFulfillment,
  CommerceOrder,
  CommerceProduct,
} from '@/lib/commerce/types'
import {
  getCustomerTagLabel,
  hasCustomerTag,
} from '@/lib/commerce/customerTagRegistry'

export type CustomerViewKey =
  | 'all'
  | 'new'
  | 'returning'
  | 'vip'
  | 'inactive'
  | 'highValue'

export type CustomerTypeFilter = 'ALL' | string

export type CustomerSortKey =
  | 'updated-desc'
  | 'created-desc'
  | 'last-purchase-desc'
  | 'lifetime-desc'
  | 'name-asc'

export type CustomerFilters = {
  view?: CustomerViewKey
  query?: string
  status?: 'ALL' | CommerceCustomerStatus
  customerType?: CustomerTypeFilter
  tag?: 'ALL' | string
  country?: 'ALL' | string
  sort?: CustomerSortKey
}

export type CustomerMetrics = {
  totalOrders: number
  lifetimeRevenue: number
  averageOrderValue: number
  largestOrder: number
  lastPurchase: string | null
  productsPurchased: number
  refunds: number
  fulfilledCount: number
}

export type CustomerRecord = {
  customer: CommerceCustomer
  metrics: CustomerMetrics
  orders: CommerceOrder[]
  fulfillments: CommerceFulfillment[]
  products: CommerceProduct[]
}

export const HIGH_LIFETIME_VALUE_THRESHOLD = 1000

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function isThisMonth(value: string) {
  const date = new Date(value)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  )
}

export function isReturningCustomer(metrics: CustomerMetrics) {
  return metrics.totalOrders > 1
}

export function isHighLifetimeValueCustomer(metrics: CustomerMetrics) {
  return metrics.lifetimeRevenue >= HIGH_LIFETIME_VALUE_THRESHOLD
}

export function getCustomerMetrics({
  customer,
  orders,
  fulfillments,
}: {
  customer: CommerceCustomer
  orders: CommerceOrder[]
  fulfillments: CommerceFulfillment[]
}): CustomerMetrics {
  const customerOrders = orders.filter(
    (order) => order.customerId === customer.id,
  )
  const completedRevenueOrders = customerOrders.filter(
    (order) => order.status !== 'CANCELLED' && !order.archivedAt,
  )
  const lifetimeRevenue = completedRevenueOrders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0,
  )
  const largestOrder = completedRevenueOrders.reduce(
    (largest, order) => Math.max(largest, Number(order.total ?? 0)),
    0,
  )
  const lastPurchase =
    completedRevenueOrders
      .map((order) => order.createdAt)
      .sort(
        (first, second) =>
          new Date(second).getTime() - new Date(first).getTime(),
      )[0] ?? null
  const productIds = new Set(
    customerOrders.flatMap((order) =>
      order.lines.map((line) => line.productId).filter(Boolean),
    ),
  )
  return {
    totalOrders: customerOrders.length,
    lifetimeRevenue,
    averageOrderValue:
      completedRevenueOrders.length > 0
        ? lifetimeRevenue / completedRevenueOrders.length
        : 0,
    largestOrder,
    lastPurchase,
    productsPurchased: productIds.size,
    refunds: customerOrders.filter(
      (order) =>
        order.paymentStatus === 'REFUNDED' ||
        order.paymentStatus === 'PARTIALLY_REFUNDED',
    ).length,
    fulfilledCount: fulfillments.filter((fulfillment) => {
      const order = customerOrders.find(
        (record) => record.id === fulfillment.orderId,
      )
      return (
        fulfillment.customerId === customer.id ||
        Boolean(order && fulfillment.orderId === order.id)
      )
    }).length,
  }
}

export function buildCustomerRecord({
  customer,
  orders,
  fulfillments,
  products,
}: {
  customer: CommerceCustomer
  orders: CommerceOrder[]
  fulfillments: CommerceFulfillment[]
  products: CommerceProduct[]
}): CustomerRecord {
  const customerOrders = orders.filter(
    (order) => order.customerId === customer.id,
  )
  const metrics = getCustomerMetrics({ customer, orders, fulfillments })
  const purchasedProductIds = new Set(
    customerOrders.flatMap((order) =>
      order.lines.map((line) => line.productId).filter(Boolean),
    ),
  )
  return {
    customer,
    metrics,
    orders: customerOrders,
    fulfillments: fulfillments.filter((fulfillment) => {
      const order = customerOrders.find(
        (record) => record.id === fulfillment.orderId,
      )
      return fulfillment.customerId === customer.id || Boolean(order)
    }),
    products: products.filter((product) => purchasedProductIds.has(product.id)),
  }
}

export function selectCustomerRecords({
  customers,
  orders,
  fulfillments,
  products,
  customerTags = [],
  customerTypes = [],
  filters = {},
}: {
  customers: CommerceCustomer[]
  orders: CommerceOrder[]
  fulfillments: CommerceFulfillment[]
  products: CommerceProduct[]
  customerTags?: CommerceCustomerTag[]
  customerTypes?: CommerceCustomerTypeDefinition[]
  filters?: CustomerFilters
}) {
  const query = normalize(filters.query)
  let rows = customers.map((customer) =>
    buildCustomerRecord({ customer, orders, fulfillments, products }),
  )

  if (filters.view === 'new') {
    rows = rows.filter((row) => row.customer.lifecycleStatus === 'NEW')
  }
  if (filters.view === 'returning') {
    rows = rows.filter((row) => isReturningCustomer(row.metrics))
  }
  if (filters.view === 'vip') {
    rows = rows.filter((row) =>
      hasCustomerTag(row.customer, 'VIP', customerTags),
    )
  }
  if (filters.view === 'inactive') {
    rows = rows.filter(
      (row) =>
        row.customer.lifecycleStatus === 'INACTIVE' ||
        Boolean(row.customer.archivedAt),
    )
  }
  if (filters.view === 'highValue') {
    rows = rows.filter((row) => isHighLifetimeValueCustomer(row.metrics))
  }
  if (filters.status && filters.status !== 'ALL') {
    rows = rows.filter((row) => row.customer.lifecycleStatus === filters.status)
  }
  if (filters.customerType && filters.customerType !== 'ALL') {
    rows = rows.filter(
      (row) => row.customer.customerTypeId === filters.customerType,
    )
  }
  if (filters.tag && filters.tag !== 'ALL') {
    rows = rows.filter((row) =>
      row.customer.tags?.includes(filters.tag as string),
    )
  }
  if (filters.country && filters.country !== 'ALL') {
    rows = rows.filter(
      (row) =>
        row.customer.shippingAddress?.country === filters.country ||
        row.customer.billingAddress?.country === filters.country,
    )
  }
  if (query) {
    rows = rows.filter((row) =>
      [
        row.customer.displayName,
        row.customer.companyName,
        row.customer.email,
        row.customer.phone,
        row.customer.lifecycleStatus,
        customerTypes.find((type) => type.id === row.customer.customerTypeId)
          ?.name,
        row.customer.tags
          ?.map((tagReference) =>
            getCustomerTagLabel(tagReference, customerTags),
          )
          .join(' '),
      ].some((value) => normalize(value).includes(query)),
    )
  }

  const sort = filters.sort ?? 'updated-desc'
  return rows.sort((first, second) => {
    if (sort === 'name-asc') {
      return first.customer.displayName.localeCompare(
        second.customer.displayName,
      )
    }
    if (sort === 'created-desc') {
      return (
        new Date(second.customer.createdAt).getTime() -
        new Date(first.customer.createdAt).getTime()
      )
    }
    if (sort === 'last-purchase-desc') {
      return (
        new Date(second.metrics.lastPurchase ?? 0).getTime() -
        new Date(first.metrics.lastPurchase ?? 0).getTime()
      )
    }
    if (sort === 'lifetime-desc') {
      return second.metrics.lifetimeRevenue - first.metrics.lifetimeRevenue
    }
    return (
      new Date(second.customer.updatedAt).getTime() -
      new Date(first.customer.updatedAt).getTime()
    )
  })
}

export function selectCustomerCounts({
  customers,
  orders,
  fulfillments,
  products,
  customerTags = [],
}: {
  customers: CommerceCustomer[]
  orders: CommerceOrder[]
  fulfillments: CommerceFulfillment[]
  products: CommerceProduct[]
  customerTags?: CommerceCustomerTag[]
}) {
  const rows = customers.map((customer) =>
    buildCustomerRecord({ customer, orders, fulfillments, products }),
  )
  return {
    all: rows.length,
    new: rows.filter((row) => isThisMonth(row.customer.createdAt)).length,
    returning: rows.filter((row) => isReturningCustomer(row.metrics)).length,
    lifetimeRevenue: rows.reduce(
      (sum, row) => sum + row.metrics.lifetimeRevenue,
      0,
    ),
    vip: rows.filter((row) => hasCustomerTag(row.customer, 'VIP', customerTags))
      .length,
    inactive: rows.filter(
      (row) =>
        row.customer.lifecycleStatus === 'INACTIVE' ||
        Boolean(row.customer.archivedAt),
    ).length,
    highValue: rows.filter((row) => isHighLifetimeValueCustomer(row.metrics))
      .length,
  }
}

export function getCustomerTagOptions(customerTags: CommerceCustomerTag[]) {
  return customerTags
    .filter((tag) => tag.status === 'active')
    .sort((first, second) => first.label.localeCompare(second.label))
}

export function getCustomerTypeOptions(
  customerTypes: CommerceCustomerTypeDefinition[],
  customers: CommerceCustomer[] = [],
) {
  const archivedTypeIdsInUse = new Set(
    customers
      .map((customer) => customer.customerTypeId)
      .filter(Boolean) as string[],
  )
  return customerTypes
    .filter((type) => type.isActive || archivedTypeIdsInUse.has(type.id))
    .sort((first, second) => first.sortOrder - second.sortOrder)
}

export function getCustomerCountryOptions(customers: CommerceCustomer[]) {
  return Array.from(
    new Set(
      customers
        .flatMap((customer) => [
          customer.billingAddress?.country,
          customer.shippingAddress?.country,
        ])
        .filter(Boolean) as string[],
    ),
  ).sort((first, second) => first.localeCompare(second))
}
