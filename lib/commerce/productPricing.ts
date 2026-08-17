import type { CommerceMoney, CommerceProduct } from '@/lib/commerce/types'

export type CommerceMargin = {
  available: boolean
  amount: number | null
  percentage: number | null
  currency: string
  reason?: string
}

export type CommercePriceRange = {
  min: number
  max: number
  currency: string
  differs: boolean
}

export function formatCommerceMoney(
  money: CommerceMoney | undefined,
  fallback = 'Not set',
) {
  if (!money) return fallback
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money.amount)
}

export function calculateCommerceMargin({
  price,
  cost,
}: {
  price?: CommerceMoney
  cost?: CommerceMoney
}): CommerceMargin {
  const currency = price?.currency ?? cost?.currency ?? 'USD'
  if (!price || !cost) {
    return {
      available: false,
      amount: null,
      percentage: null,
      currency,
      reason: 'Cost is not set',
    }
  }
  if (price.currency !== cost.currency) {
    return {
      available: false,
      amount: null,
      percentage: null,
      currency,
      reason: 'Currency mismatch',
    }
  }
  const amount = price.amount - cost.amount
  const percentage = price.amount > 0 ? (amount / price.amount) * 100 : null
  return {
    available: percentage !== null,
    amount,
    percentage,
    currency,
    reason: percentage === null ? 'Price is zero' : undefined,
  }
}

export function getProductPriceRange(
  product: CommerceProduct,
): CommercePriceRange {
  const prices = product.hasVariants
    ? product.variants
        .map((variant) => variant.price ?? product.price)
        .filter((price): price is CommerceMoney => Boolean(price))
    : [product.price]
  const currency = prices[0]?.currency ?? product.price.currency
  const amounts = prices.map((price) => price.amount)
  const min = amounts.length ? Math.min(...amounts) : product.price.amount
  const max = amounts.length ? Math.max(...amounts) : product.price.amount
  return {
    min,
    max,
    currency,
    differs: min !== max,
  }
}

export function formatProductPriceRange(product: CommerceProduct) {
  const range = getProductPriceRange(product)
  const min = formatCommerceMoney({
    amount: range.min,
    currency: range.currency,
  })
  if (!range.differs) return min
  return `${min} - ${formatCommerceMoney({
    amount: range.max,
    currency: range.currency,
  })}`
}
