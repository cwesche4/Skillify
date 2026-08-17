import type {
  CommerceAddress,
  CommerceCustomer,
  CommerceDiscountType,
  CommerceFulfillmentStatus,
  CommerceOrder,
  CommerceOrderLine,
  CommerceOrderStatus,
  CommercePaymentStatus,
  CommerceProduct,
  CommerceShippingPayer,
} from '@/lib/commerce/types'
import {
  calculateOrderFinancials,
  normalizeDiscountType,
  resolveLineDiscountAmount,
} from '@/lib/commerce/calculateOrderFinancials'

export type OrderViewKey = 'all' | 'draft' | 'open' | 'completed' | 'archived'

export type OrderSortKey =
  | 'created-desc'
  | 'created-asc'
  | 'updated-desc'
  | 'total-desc'
  | 'total-asc'
  | 'profit-desc'
  | 'margin-asc'

export type OrderProfitabilityFilter =
  | 'ALL'
  | 'PROFITABLE'
  | 'LOSS'
  | 'INCOMPLETE'
  | 'MISSING_COST'

export type OrderFilters = {
  view?: OrderViewKey
  query?: string
  status?: 'ALL' | CommerceOrderStatus
  paymentStatus?: 'ALL' | CommercePaymentStatus
  fulfillmentStatus?: 'ALL' | CommerceFulfillmentStatus
  shippingPayer?: 'ALL' | CommerceShippingPayer
  profitability?: OrderProfitabilityFilter
  sort?: OrderSortKey
}

export type OrderLineInput = Partial<
  Pick<
    CommerceOrderLine,
    | 'id'
    | 'orderId'
    | 'productId'
    | 'variantId'
    | 'name'
    | 'sku'
    | 'quantity'
    | 'unitPrice'
    | 'discountType'
    | 'discountValue'
    | 'resolvedDiscountAmount'
    | 'discountTotal'
    | 'taxTotal'
    | 'unitCost'
  >
>

export type OrderValidationInput = Partial<
  Omit<
    Pick<
      CommerceOrder,
      | 'customerId'
      | 'status'
      | 'paymentStatus'
      | 'fulfillmentStatus'
      | 'currency'
      | 'discountTotal'
      | 'taxTotal'
      | 'shippingTotal'
      | 'shippingCharge'
      | 'shippingCost'
      | 'shippingPayer'
      | 'billingAddress'
      | 'shippingAddress'
      | 'shippingSameAsBilling'
      | 'shippingMethod'
      | 'shippingCarrier'
      | 'trackingNumber'
      | 'estimatedDelivery'
      | 'orderNotes'
    >,
    'billingAddress' | 'shippingAddress'
  >
> & {
  billingAddress?: Partial<CommerceAddress>
  shippingAddress?: Partial<CommerceAddress>
  lines?: OrderLineInput[]
  inlineCustomer?: Partial<CommerceCustomer>
}

export type OrderValidationResult = {
  valid: boolean
  errors: Record<string, string>
}

export type OrderTotals = {
  subtotal: number
  discountTotal: number
  taxTotal: number
  shippingTotal: number
  total: number
}

export type OrderInventoryImpact = {
  productId?: string
  variantId?: string
  name: string
  orderedQuantity: number
  availableInventory: number | null
  reservedPreviewQuantity: number
  outgoingPreviewQuantity: number
  remainingPreviewQuantity: number | null
  tracked: boolean
}

export type CustomerOrderMetrics = {
  customerSince: string | null
  totalOrders: number
  lifetimeSpend: number
}

export type OrderLinePresentation = {
  productName: string
  variantName: string | null
  sku: string
  isCustom: boolean
  optionValues: string[]
  quantity: number
  unitPrice: number
  unitCost: number | null
  subtotal: number
}

export const COMMERCE_DISCOUNT_TYPE_OPTIONS: Array<{
  value: CommerceDiscountType
  label: string
}> = [
  { value: 'NONE', label: 'None' },
  { value: 'FIXED_AMOUNT', label: 'Fixed amount' },
  { value: 'PERCENTAGE', label: 'Percentage' },
]

function normalize(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? ''
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

function clean(value: string | undefined | null) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function normalizeCommerceAddress(
  address: Partial<CommerceAddress> | null | undefined,
): CommerceAddress | undefined {
  if (!address) return undefined
  const normalized = {
    name: clean(address.name),
    company: clean(address.company),
    line1: clean(address.line1) ?? '',
    line2: clean(address.line2),
    city: clean(address.city) ?? '',
    region: clean(address.region),
    postalCode: clean(address.postalCode) ?? '',
    country: clean(address.country) ?? '',
    phone: clean(address.phone),
  }
  if (isCommerceAddressEmpty(normalized)) return undefined
  return normalized
}

export function isCommerceAddressEmpty(
  address: Partial<CommerceAddress> | null | undefined,
) {
  if (!address) return true
  return [
    address.name,
    address.company,
    address.line1,
    address.line2,
    address.city,
    address.region,
    address.postalCode,
    address.country,
    address.phone,
  ].every((value) => !value?.trim())
}

export function formatCommerceAddressLines(
  address: Partial<CommerceAddress> | null | undefined,
) {
  const normalized = normalizeCommerceAddress(address)
  if (!normalized) return []
  const cityRegionPostal = [
    normalized.city,
    normalized.region,
    normalized.postalCode,
  ]
    .filter(Boolean)
    .join(', ')
  return [
    normalized.name,
    normalized.company,
    normalized.line1,
    normalized.line2,
    cityRegionPostal,
    normalized.country,
    normalized.phone,
  ].filter((line): line is string => Boolean(line))
}

export function formatCommerceAddress(
  address: Partial<CommerceAddress> | null | undefined,
  fallback = 'Not provided',
) {
  const lines = formatCommerceAddressLines(address)
  return lines.length ? lines.join('\n') : fallback
}

export function getEffectiveShippingAddress(order: CommerceOrder) {
  if (order.shippingSameAsBilling) return order.billingAddress
  return order.shippingAddress
}

export function calculateOrderLineTotals(
  line: OrderLineInput,
): Pick<
  CommerceOrderLine,
  'subtotal' | 'discountTotal' | 'taxTotal' | 'lineTotal'
> {
  const quantity = Math.max(0, Number(line.quantity ?? 0))
  const unitPrice = Math.max(0, Number(line.unitPrice ?? 0))
  const subtotal = roundMoney(quantity * unitPrice)
  const discountTotal = resolveLineDiscountAmount({
    ...line,
    quantity,
    unitPrice,
    discountType:
      line.discountType == null && Number(line.discountTotal ?? 0) <= 0
        ? 'NONE'
        : normalizeDiscountType(line.discountType),
  })
  const taxTotal = Math.max(0, roundMoney(Number(line.taxTotal ?? 0)))
  return {
    subtotal,
    discountTotal,
    taxTotal,
    lineTotal: roundMoney(Math.max(0, subtotal - discountTotal) + taxTotal),
  }
}

export function calculateOrderTotals({
  lines,
  shippingTotal = 0,
  shippingCharge,
  shippingCost,
  shippingPayer,
  products = [],
}: {
  lines: OrderLineInput[]
  shippingTotal?: number
  shippingCharge?: number
  shippingCost?: number
  shippingPayer?: CommerceShippingPayer
  products?: CommerceProduct[]
}): OrderTotals {
  const financials = calculateOrderFinancials({
    lines,
    products,
    shippingCharge: shippingCharge ?? shippingTotal,
    shippingCost,
    shippingPayer,
  })
  return {
    subtotal: financials.merchandiseSubtotal,
    discountTotal: financials.discounts,
    taxTotal: financials.taxes,
    shippingTotal: financials.shippingRevenue,
    total: financials.customerTotal,
  }
}

export function getOrderCustomerLabel(
  order: CommerceOrder,
  customers: CommerceCustomer[] = [],
) {
  const customer = order.customerId
    ? customers.find((record) => record.id === order.customerId)
    : null
  return (
    customer?.displayName ??
    order.customerSnapshot?.displayName ??
    order.customerSnapshot?.companyName ??
    'Guest customer'
  )
}

export function isMeaningfulOptionalIdentityValue(value: unknown) {
  if (typeof value !== 'string') return false
  const normalized = value.trim()
  if (!normalized) return false
  return !['not set', 'none', 'n/a', 'na', 'null', 'undefined'].includes(
    normalized.toLowerCase(),
  )
}

export function getMeaningfulOptionalIdentityValue(...values: unknown[]) {
  return values.find(isMeaningfulOptionalIdentityValue) as string | undefined
}

export function getCustomerOrderMetrics({
  customerId,
  orders,
}: {
  customerId?: string
  orders: CommerceOrder[]
}): CustomerOrderMetrics {
  if (!customerId) {
    return { customerSince: null, totalOrders: 0, lifetimeSpend: 0 }
  }
  const customerOrders = orders.filter(
    (order) =>
      !order.archivedAt &&
      order.customerId === customerId &&
      order.status !== 'CANCELLED',
  )
  const firstOrder = customerOrders
    .slice()
    .sort(
      (first, second) =>
        new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime(),
    )[0]
  return {
    customerSince: firstOrder?.createdAt ?? null,
    totalOrders: customerOrders.length,
    lifetimeSpend: roundMoney(
      customerOrders
        .filter((order) => order.paymentStatus === 'PAID')
        .reduce((total, order) => total + order.total, 0),
    ),
  }
}

export function getOrderLinePresentation({
  line,
  products,
}: {
  line: CommerceOrderLine
  products: CommerceProduct[]
}): OrderLinePresentation {
  const product = line.productId
    ? products.find((record) => record.id === line.productId)
    : undefined
  const variant = line.variantId
    ? product?.variants.find((record) => record.id === line.variantId)
    : undefined
  const optionValues = variant
    ? Object.entries(variant.optionValues ?? {}).map(
        ([key, value]) => `${key}: ${value}`,
      )
    : []
  return {
    productName: product?.name ?? line.name,
    variantName: variant?.name ?? null,
    sku: line.sku || variant?.sku || product?.sku || 'Not set',
    isCustom: !product,
    optionValues,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    unitCost:
      line.unitCost ?? variant?.cost?.amount ?? product?.cost?.amount ?? null,
    subtotal: line.subtotal,
  }
}

export function isOrderOpen(order: CommerceOrder) {
  return !order.archivedAt && !['COMPLETED', 'CANCELLED'].includes(order.status)
}

export function selectOrderCounts(orders: CommerceOrder[]) {
  const activeOrders = orders.filter((order) => !order.archivedAt)
  const paidRevenue = activeOrders
    .filter((order) => order.paymentStatus === 'PAID')
    .reduce((total, order) => total + order.total, 0)

  return {
    all: activeOrders.length,
    draft: activeOrders.filter((order) => order.status === 'DRAFT').length,
    open: activeOrders.filter(isOrderOpen).length,
    completed: activeOrders.filter((order) => order.status === 'COMPLETED')
      .length,
    archived: orders.filter((order) => Boolean(order.archivedAt)).length,
    revenue: roundMoney(paidRevenue),
  }
}

export function selectOrders(
  orders: CommerceOrder[],
  customers: CommerceCustomer[] = [],
  filters: OrderFilters = {},
  products: CommerceProduct[] = [],
) {
  const query = normalize(filters.query)
  let rows = orders.slice()
  const view = filters.view ?? 'all'

  if (view === 'all') rows = rows.filter((order) => !order.archivedAt)
  if (view === 'draft') {
    rows = rows.filter((order) => !order.archivedAt && order.status === 'DRAFT')
  }
  if (view === 'open') rows = rows.filter(isOrderOpen)
  if (view === 'completed') {
    rows = rows.filter(
      (order) => !order.archivedAt && order.status === 'COMPLETED',
    )
  }
  if (view === 'archived')
    rows = rows.filter((order) => Boolean(order.archivedAt))

  if (filters.status && filters.status !== 'ALL') {
    rows = rows.filter((order) => order.status === filters.status)
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
    rows = rows.filter((order) => order.paymentStatus === filters.paymentStatus)
  }
  if (filters.fulfillmentStatus && filters.fulfillmentStatus !== 'ALL') {
    rows = rows.filter(
      (order) => order.fulfillmentStatus === filters.fulfillmentStatus,
    )
  }
  if (filters.shippingPayer && filters.shippingPayer !== 'ALL') {
    rows = rows.filter((order) => order.shippingPayer === filters.shippingPayer)
  }
  if (filters.profitability && filters.profitability !== 'ALL') {
    rows = rows.filter((order) => {
      const financials = calculateOrderFinancials({
        lines: order.lines,
        products,
        shippingCharge: order.shippingCharge ?? order.shippingTotal,
        shippingCost: order.shippingCost,
        shippingPayer: order.shippingPayer,
        currency: order.currency,
      })
      if (filters.profitability === 'INCOMPLETE') {
        return !financials.profitabilityComplete
      }
      if (filters.profitability === 'MISSING_COST') {
        return financials.missingCostCount > 0
      }
      if (
        !financials.profitabilityComplete ||
        financials.orderGrossProfit == null
      ) {
        return false
      }
      if (filters.profitability === 'PROFITABLE')
        return financials.orderGrossProfit >= 0
      if (filters.profitability === 'LOSS')
        return financials.orderGrossProfit < 0
      return true
    })
  }

  if (query) {
    rows = rows.filter((order) => {
      const customerLabel = getOrderCustomerLabel(order, customers)
      const values = [
        order.orderNumber,
        customerLabel,
        order.customerSnapshot?.email,
        order.customerSnapshot?.phone,
        ...order.lines.flatMap((line) => [line.name, line.sku]),
      ]
      return values.some((value) => normalize(value).includes(query))
    })
  }

  const sort = filters.sort ?? 'updated-desc'
  return rows.slice().sort((first, second) => {
    if (sort === 'created-asc') {
      return (
        new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime()
      )
    }
    if (sort === 'created-desc') {
      return (
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime()
      )
    }
    if (sort === 'total-desc' || sort === 'total-asc') {
      const firstRevenue = calculateOrderFinancials({
        lines: first.lines,
        products,
        shippingCharge: first.shippingCharge ?? first.shippingTotal,
        shippingCost: first.shippingCost,
        shippingPayer: first.shippingPayer,
      }).totalOrderRevenue
      const secondRevenue = calculateOrderFinancials({
        lines: second.lines,
        products,
        shippingCharge: second.shippingCharge ?? second.shippingTotal,
        shippingCost: second.shippingCost,
        shippingPayer: second.shippingPayer,
      }).totalOrderRevenue
      return sort === 'total-desc'
        ? secondRevenue - firstRevenue
        : firstRevenue - secondRevenue
    }
    if (sort === 'profit-desc') {
      const firstProfit =
        calculateOrderFinancials({
          lines: first.lines,
          products,
          shippingCharge: first.shippingCharge ?? first.shippingTotal,
          shippingCost: first.shippingCost,
          shippingPayer: first.shippingPayer,
        }).orderGrossProfit ?? Number.NEGATIVE_INFINITY
      const secondProfit =
        calculateOrderFinancials({
          lines: second.lines,
          products,
          shippingCharge: second.shippingCharge ?? second.shippingTotal,
          shippingCost: second.shippingCost,
          shippingPayer: second.shippingPayer,
        }).orderGrossProfit ?? Number.NEGATIVE_INFINITY
      return secondProfit - firstProfit
    }
    if (sort === 'margin-asc') {
      const firstMargin =
        calculateOrderFinancials({
          lines: first.lines,
          products,
          shippingCharge: first.shippingCharge ?? first.shippingTotal,
          shippingCost: first.shippingCost,
          shippingPayer: first.shippingPayer,
        }).orderMarginPercent ?? Number.POSITIVE_INFINITY
      const secondMargin =
        calculateOrderFinancials({
          lines: second.lines,
          products,
          shippingCharge: second.shippingCharge ?? second.shippingTotal,
          shippingCost: second.shippingCost,
          shippingPayer: second.shippingPayer,
        }).orderMarginPercent ?? Number.POSITIVE_INFINITY
      return firstMargin - secondMargin
    }
    return (
      new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
    )
  })
}

export function validateOrderInput({
  input,
  customers,
  products,
  workspaceId,
}: {
  input: OrderValidationInput
  customers: CommerceCustomer[]
  products: CommerceProduct[]
  workspaceId: string
}): OrderValidationResult {
  const errors: Record<string, string> = {}
  const hasExistingCustomer = Boolean(
    input.customerId &&
    customers.some(
      (customer) =>
        customer.workspaceId === workspaceId &&
        customer.id === input.customerId,
    ),
  )
  const inlineName = input.inlineCustomer?.displayName?.trim()
  const inlineEmail = input.inlineCustomer?.email?.trim()

  if (!hasExistingCustomer && !inlineName && !inlineEmail) {
    errors.customer = 'Select a customer or create one inline.'
  }
  if (!input.lines?.length) {
    errors.lines = 'Add at least one product or custom line item.'
  }

  input.lines?.forEach((line, index) => {
    if (!line.name?.trim())
      errors[`lines.${index}.name`] = 'Item name is required.'
    if (!line.quantity || Number(line.quantity) <= 0) {
      errors[`lines.${index}.quantity`] = 'Quantity must be greater than zero.'
    }
    if (line.unitPrice == null || Number(line.unitPrice) < 0) {
      errors[`lines.${index}.unitPrice`] = 'Price cannot be negative.'
    }
    if (
      line.discountType === 'PERCENTAGE' &&
      Number(line.discountValue ?? 0) > 100
    ) {
      errors[`lines.${index}.discountValue`] =
        'Percentage discount cannot exceed 100%.'
    }
    if (line.discountValue != null && Number(line.discountValue) < 0) {
      errors[`lines.${index}.discountValue`] = 'Discount cannot be negative.'
    }
    if (
      line.productId &&
      !products.some(
        (product) =>
          product.workspaceId === workspaceId && product.id === line.productId,
      )
    ) {
      errors[`lines.${index}.productId`] =
        'Selected product is no longer available.'
    }
  })

  for (const [key, value] of [
    ['discountTotal', input.discountTotal],
    ['taxTotal', input.taxTotal],
    ['shippingTotal', input.shippingTotal],
    ['shippingCharge', input.shippingCharge],
    ['shippingCost', input.shippingCost],
  ] as const) {
    if (value != null && Number(value) < 0) {
      errors[key] = 'Amount cannot be negative.'
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

export function calculateOrderInventoryImpact({
  orders,
  products,
}: {
  orders: CommerceOrder[]
  products: CommerceProduct[]
}): OrderInventoryImpact[] {
  const quantityByItem = new Map<string, number>()
  for (const order of orders) {
    if (order.archivedAt || order.status === 'CANCELLED') continue
    for (const line of order.lines) {
      const key = line.variantId ?? line.productId
      if (!key) continue
      quantityByItem.set(key, (quantityByItem.get(key) ?? 0) + line.quantity)
    }
  }

  return Array.from(quantityByItem.entries()).map(
    ([itemId, orderedQuantity]) => {
      const product = products.find(
        (record) =>
          record.id === itemId ||
          record.variants.some((variant) => variant.id === itemId),
      )
      const variant = product?.variants.find((record) => record.id === itemId)
      const tracked = Boolean(product?.trackInventory)
      const availableInventory = !tracked
        ? null
        : variant
          ? (variant.inventoryQuantity ?? 0)
          : (product?.inventoryQuantity ?? 0)
      return {
        productId: product?.id,
        variantId: variant?.id,
        name: variant
          ? `${product?.name ?? 'Product'} - ${variant.name}`
          : (product?.name ?? 'Item'),
        orderedQuantity,
        availableInventory,
        reservedPreviewQuantity: orderedQuantity,
        outgoingPreviewQuantity: orderedQuantity,
        remainingPreviewQuantity:
          availableInventory == null
            ? null
            : availableInventory - orderedQuantity,
        tracked,
      }
    },
  )
}
