import type {
  CommerceOrder,
  CommerceOrderLine,
  CommerceProduct,
  CommerceDiscountType,
  CommerceShippingPayer,
} from '@/lib/commerce/types'

export type FinancialLineInput = Partial<
  Pick<
    CommerceOrderLine,
    | 'productId'
    | 'variantId'
    | 'quantity'
    | 'unitPrice'
    | 'unitCost'
    | 'discountType'
    | 'discountValue'
    | 'resolvedDiscountAmount'
    | 'discountTotal'
    | 'taxTotal'
  >
>

export type OrderFinancialInput = {
  lines: FinancialLineInput[]
  products?: CommerceProduct[]
  shippingCharge?: number
  shippingCost?: number
  shippingPayer?: CommerceShippingPayer
  currency?: string
}

export type OrderFinancialResult = {
  currency: string
  merchandiseSubtotal: number
  merchandiseDiscounts: number
  merchandiseRevenue: number
  shippingRevenue: number
  totalOrderRevenue: number
  grossRevenue: number
  discounts: number
  taxes: number
  customerTotal: number
  costOfGoodsSold: number
  shippingExpense: number
  totalCost: number | null
  merchandiseGrossProfit: number | null
  orderGrossProfit: number | null
  merchandiseMarginPercent: number | null
  orderMarginPercent: number | null
  grossProfit: number | null
  marginPercent: number | null
  missingCostCount: number
  profitabilityComplete: boolean
  profitBearingRevenue: number
  shippingPayer: CommerceShippingPayer
}

function money(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * 100) / 100
}

function findLineCost(line: FinancialLineInput, products: CommerceProduct[]) {
  if (line.unitCost != null) return Number(line.unitCost)
  const product = line.productId
    ? products.find((record) => record.id === line.productId)
    : undefined
  const variant = line.variantId
    ? product?.variants.find((record) => record.id === line.variantId)
    : undefined
  const cost = variant?.cost?.amount ?? product?.cost?.amount
  return cost
}

export function normalizeDiscountType(
  value: CommerceDiscountType | string | null | undefined,
): CommerceDiscountType {
  if (value === 'PERCENTAGE' || value === 'FIXED_AMOUNT' || value === 'NONE') {
    return value
  }
  return 'FIXED_AMOUNT'
}

export function resolveLineDiscountAmount(line: FinancialLineInput) {
  const quantity = Math.max(0, Number(line.quantity ?? 0))
  const unitPrice = Math.max(0, Number(line.unitPrice ?? 0))
  const subtotal = money(quantity * unitPrice)
  const discountType =
    line.discountType == null
      ? Number(line.discountTotal ?? 0) > 0
        ? 'FIXED_AMOUNT'
        : 'NONE'
      : normalizeDiscountType(line.discountType)
  const sourceValue =
    line.discountValue ?? line.resolvedDiscountAmount ?? line.discountTotal ?? 0
  const discountValue = Math.max(0, Number(sourceValue ?? 0))
  if (discountType === 'NONE') return 0
  const rawDiscount =
    discountType === 'PERCENTAGE'
      ? subtotal * (Math.min(100, discountValue) / 100)
      : discountValue
  return money(Math.min(subtotal, Math.max(0, rawDiscount)))
}

export function calculateOrderFinancials({
  lines,
  products = [],
  shippingCharge = 0,
  shippingCost = 0,
  shippingPayer = 'CUSTOMER',
  currency = 'USD',
}: OrderFinancialInput): OrderFinancialResult {
  let merchandiseSubtotal = 0
  let merchandiseDiscounts = 0
  let taxes = 0
  let costOfGoodsSold = 0
  let missingCostCount = 0

  for (const line of lines) {
    const quantity = Math.max(0, Number(line.quantity ?? 0))
    const unitPrice = Math.max(0, Number(line.unitPrice ?? 0))
    const lineSubtotal = money(quantity * unitPrice)
    merchandiseSubtotal += lineSubtotal
    merchandiseDiscounts += resolveLineDiscountAmount(line)
    taxes += Math.max(0, Number(line.taxTotal ?? 0))
    const unitCost = findLineCost(line, products)
    if (unitCost == null || !Number.isFinite(Number(unitCost))) {
      if (quantity > 0) missingCostCount += 1
    } else {
      costOfGoodsSold += Math.max(0, Number(unitCost)) * quantity
    }
  }

  const shippingRevenue = Math.max(0, Number(shippingCharge ?? 0))
  const shippingExpense = Math.max(0, Number(shippingCost ?? 0))
  const merchandiseRevenue = money(
    Math.max(0, merchandiseSubtotal - merchandiseDiscounts),
  )
  const totalOrderRevenue = money(merchandiseRevenue + shippingRevenue)
  const grossRevenue = totalOrderRevenue
  const profitBearingRevenue = totalOrderRevenue
  const customerTotal = money(merchandiseRevenue + shippingRevenue + taxes)
  const profitabilityComplete = missingCostCount === 0
  const totalCost = profitabilityComplete
    ? money(costOfGoodsSold + shippingExpense)
    : null
  const merchandiseGrossProfit = profitabilityComplete
    ? money(merchandiseRevenue - costOfGoodsSold)
    : null
  const orderGrossProfit = profitabilityComplete
    ? money(totalOrderRevenue - costOfGoodsSold - shippingExpense)
    : null
  const merchandiseMarginPercent =
    profitabilityComplete &&
    merchandiseRevenue > 0 &&
    merchandiseGrossProfit != null
      ? Math.round((merchandiseGrossProfit / merchandiseRevenue) * 1000) / 10
      : null
  const orderMarginPercent =
    profitabilityComplete && totalOrderRevenue > 0 && orderGrossProfit != null
      ? Math.round((orderGrossProfit / totalOrderRevenue) * 1000) / 10
      : null

  return {
    currency,
    merchandiseSubtotal: money(merchandiseSubtotal),
    merchandiseDiscounts: money(merchandiseDiscounts),
    merchandiseRevenue: money(merchandiseRevenue),
    shippingRevenue: money(shippingRevenue),
    totalOrderRevenue,
    grossRevenue: money(grossRevenue),
    discounts: money(merchandiseDiscounts),
    taxes: money(taxes),
    customerTotal: money(customerTotal),
    costOfGoodsSold: money(costOfGoodsSold),
    shippingExpense: money(shippingExpense),
    totalCost,
    merchandiseGrossProfit,
    orderGrossProfit,
    merchandiseMarginPercent,
    orderMarginPercent,
    grossProfit: orderGrossProfit,
    marginPercent: orderMarginPercent,
    missingCostCount,
    profitabilityComplete,
    profitBearingRevenue: money(profitBearingRevenue),
    shippingPayer,
  }
}

export function calculateOrderFinancialsFromOrder(
  order: CommerceOrder,
  products: CommerceProduct[] = [],
) {
  return calculateOrderFinancials({
    lines: order.lines,
    products,
    shippingCharge: order.shippingCharge ?? order.shippingTotal,
    shippingCost: order.shippingCost,
    shippingPayer: order.shippingPayer,
    currency: order.currency,
  })
}

export function summarizeOrderFinancials(
  orders: CommerceOrder[],
  products: CommerceProduct[] = [],
) {
  const activeOrders = orders.filter(
    (order) => !order.archivedAt && order.status !== 'CANCELLED',
  )
  const financials = activeOrders.map((order) =>
    calculateOrderFinancialsFromOrder(order, products),
  )
  const complete = financials.filter((result) => result.profitabilityComplete)
  const merchandiseRevenue = financials.reduce(
    (total, result) => total + result.merchandiseRevenue,
    0,
  )
  const shippingRevenue = financials.reduce(
    (total, result) => total + result.shippingRevenue,
    0,
  )
  const revenue = financials.reduce(
    (total, result) => total + result.totalOrderRevenue,
    0,
  )
  const costOfGoodsSold = financials.reduce(
    (total, result) => total + result.costOfGoodsSold,
    0,
  )
  const shippingExpense = financials.reduce(
    (total, result) => total + result.shippingExpense,
    0,
  )
  const merchandiseGrossProfit = complete.reduce(
    (total, result) => total + (result.merchandiseGrossProfit ?? 0),
    0,
  )
  const orderGrossProfit = complete.reduce(
    (total, result) => total + (result.orderGrossProfit ?? 0),
    0,
  )
  const completeMerchandiseRevenue = complete.reduce(
    (total, result) => total + result.merchandiseRevenue,
    0,
  )
  const completeOrderRevenue = complete.reduce(
    (total, result) => total + result.totalOrderRevenue,
    0,
  )

  return {
    orderCount: activeOrders.length,
    completeOrderCount: complete.length,
    incompleteOrderCount: financials.length - complete.length,
    merchandiseRevenue: money(merchandiseRevenue),
    shippingRevenue: money(shippingRevenue),
    revenue: money(revenue),
    totalOrderRevenue: money(revenue),
    costOfGoodsSold: money(costOfGoodsSold),
    shippingExpense: money(shippingExpense),
    merchandiseGrossProfit:
      complete.length === financials.length
        ? money(merchandiseGrossProfit)
        : null,
    orderGrossProfit:
      complete.length === financials.length ? money(orderGrossProfit) : null,
    grossProfit:
      complete.length === financials.length ? money(orderGrossProfit) : null,
    knownGrossProfit: money(orderGrossProfit),
    merchandiseMarginPercent:
      completeMerchandiseRevenue > 0
        ? Math.round(
            (merchandiseGrossProfit / completeMerchandiseRevenue) * 1000,
          ) / 10
        : null,
    orderMarginPercent:
      completeOrderRevenue > 0
        ? Math.round((orderGrossProfit / completeOrderRevenue) * 1000) / 10
        : null,
    marginPercent:
      completeOrderRevenue > 0
        ? Math.round((orderGrossProfit / completeOrderRevenue) * 1000) / 10
        : null,
    averageOrderValue:
      activeOrders.length > 0 ? money(revenue / activeOrders.length) : 0,
    averageProfitPerOrder:
      complete.length > 0 ? money(orderGrossProfit / complete.length) : null,
  }
}
