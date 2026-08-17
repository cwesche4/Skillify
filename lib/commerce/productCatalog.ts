import {
  type CommerceInventoryState,
  COMMERCE_PRODUCT_VARIANT_LIMITS,
} from '@/lib/commerce/commerceRegistry'
import type {
  CommerceMoney,
  CommerceProduct,
  CommerceProductStatus,
  CommerceProductVariant,
} from '@/lib/commerce/types'

export type ProductViewKey =
  | 'all'
  | 'active'
  | 'draft'
  | 'archived'
  | 'low-stock'

export type ProductSortKey =
  | 'name-asc'
  | 'name-desc'
  | 'updated-desc'
  | 'price-asc'
  | 'price-desc'
  | 'inventory-asc'

export type ProductFilters = {
  view?: ProductViewKey
  query?: string
  status?: 'ALL' | CommerceProductStatus
  category?: string
  inventory?: CommerceInventoryState
  sort?: ProductSortKey
}

export type ProductValidationInput = Partial<
  Omit<CommerceProduct, 'price' | 'compareAtPrice' | 'cost' | 'variants'>
> & {
  price?: Partial<CommerceMoney>
  compareAtPrice?: Partial<CommerceMoney>
  cost?: Partial<CommerceMoney>
  variants?: Array<Partial<CommerceProductVariant>>
}

export type ProductValidationResult = {
  valid: boolean
  errors: Record<string, string>
}

function normalize(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? ''
}

export function isProductLowStock(product: CommerceProduct) {
  if (!product.trackInventory) return false
  const threshold = product.lowStockThreshold
  if (threshold == null) return false
  if (product.hasVariants && product.variants.length > 0) {
    return product.variants.some((variant) => {
      if (variant.inventoryQuantity == null) return false
      return variant.inventoryQuantity <= threshold
    })
  }
  if (product.inventoryQuantity == null) return false
  return product.inventoryQuantity <= threshold
}

export function getProductInventoryState(
  product: CommerceProduct,
): Exclude<CommerceInventoryState, 'ALL'> {
  if (!product.trackInventory) return 'NOT_TRACKED'
  const quantities =
    product.hasVariants && product.variants.length > 0
      ? product.variants
          .map((variant) => variant.inventoryQuantity)
          .filter(
            (quantity): quantity is number => typeof quantity === 'number',
          )
      : typeof product.inventoryQuantity === 'number'
        ? [product.inventoryQuantity]
        : []
  if (!quantities.length) return 'OUT_OF_STOCK'
  if (quantities.every((quantity) => quantity <= 0)) return 'OUT_OF_STOCK'
  if (isProductLowStock(product)) return 'LOW_STOCK'
  return 'IN_STOCK'
}

export function getProductInventoryQuantity(product: CommerceProduct) {
  if (!product.trackInventory) return null
  if (product.hasVariants && product.variants.length > 0) {
    return product.variants.reduce(
      (total, variant) => total + (variant.inventoryQuantity ?? 0),
      0,
    )
  }
  return product.inventoryQuantity ?? 0
}

export function getProductSkuDisplay(product: CommerceProduct) {
  if (product.sku) return product.sku
  const variantSkus = Array.from(
    new Set(product.variants.map((variant) => variant.sku).filter(Boolean)),
  )
  if (variantSkus.length > 1) return 'Multiple variants'
  return variantSkus[0] ?? 'Not set'
}

export function getProductCategoryOptions(products: CommerceProduct[]) {
  return Array.from(
    new Set(
      products
        .map((product) => product.category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort((first, second) => first.localeCompare(second))
}

export function selectProductCounts(products: CommerceProduct[]) {
  return {
    all: products.length,
    active: products.filter((product) => product.status === 'ACTIVE').length,
    draft: products.filter((product) => product.status === 'DRAFT').length,
    archived: products.filter((product) => product.status === 'ARCHIVED')
      .length,
    lowStock: products.filter(isProductLowStock).length,
  }
}

export function selectProducts(
  products: CommerceProduct[],
  filters: ProductFilters = {},
) {
  const query = normalize(filters.query)
  let rows = products.slice()
  const view = filters.view ?? 'all'

  if (view === 'active')
    rows = rows.filter((product) => product.status === 'ACTIVE')
  if (view === 'draft')
    rows = rows.filter((product) => product.status === 'DRAFT')
  if (view === 'archived') {
    rows = rows.filter((product) => product.status === 'ARCHIVED')
  }
  if (view === 'low-stock') rows = rows.filter(isProductLowStock)
  if (filters.status && filters.status !== 'ALL') {
    rows = rows.filter((product) => product.status === filters.status)
  }
  if (filters.category && filters.category !== 'ALL') {
    rows = rows.filter((product) => product.category === filters.category)
  }
  if (filters.inventory && filters.inventory !== 'ALL') {
    rows = rows.filter(
      (product) => getProductInventoryState(product) === filters.inventory,
    )
  }
  if (query) {
    rows = rows.filter((product) => {
      const values = [
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.vendor,
        ...(product.tags ?? []),
        ...product.variants.flatMap((variant) => [
          variant.name,
          variant.sku,
          variant.barcode,
        ]),
      ]
      return values.some((value) => normalize(value).includes(query))
    })
  }

  const sorted = rows.slice()
  const sort = filters.sort ?? 'updated-desc'
  sorted.sort((first, second) => {
    if (sort === 'name-asc') return first.name.localeCompare(second.name)
    if (sort === 'name-desc') return second.name.localeCompare(first.name)
    if (sort === 'price-asc') return first.price.amount - second.price.amount
    if (sort === 'price-desc') return second.price.amount - first.price.amount
    if (sort === 'inventory-asc') {
      return (
        (getProductInventoryQuantity(first) ?? Number.MAX_SAFE_INTEGER) -
        (getProductInventoryQuantity(second) ?? Number.MAX_SAFE_INTEGER)
      )
    }
    return (
      new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
    )
  })

  return sorted
}

export function validateProductInput({
  input,
  existingProducts,
  workspaceId,
  productId,
}: {
  input: ProductValidationInput
  existingProducts: CommerceProduct[]
  workspaceId: string
  productId?: string
}): ProductValidationResult {
  const errors: Record<string, string> = {}
  const name = input.name?.trim()
  if (!name) errors.name = 'Product name is required.'
  const priceAmount = Number(input.price?.amount ?? 0)
  if (!Number.isFinite(priceAmount) || priceAmount < 0) {
    errors.price = 'Price cannot be negative.'
  }
  for (const [key, money] of [
    ['compareAtPrice', input.compareAtPrice],
    ['cost', input.cost],
  ] as const) {
    if (money?.amount != null) {
      const amount = Number(money.amount)
      if (!Number.isFinite(amount) || amount < 0) {
        errors[key] =
          key === 'cost'
            ? 'Cost cannot be negative.'
            : 'Compare-at price cannot be negative.'
      }
    }
  }
  for (const [key, value] of [
    ['inventoryQuantity', input.inventoryQuantity],
    ['lowStockThreshold', input.lowStockThreshold],
  ] as const) {
    if (value != null && value < 0) {
      errors[key] =
        key === 'inventoryQuantity'
          ? 'Inventory cannot be negative.'
          : 'Low-stock threshold cannot be negative.'
    }
  }

  const scopedProducts = existingProducts.filter(
    (product) =>
      product.workspaceId === workspaceId && product.id !== productId,
  )
  const parentSku = normalize(input.sku)
  if (
    parentSku &&
    scopedProducts.some(
      (product) =>
        normalize(product.sku) === parentSku ||
        product.variants.some(
          (variant) => normalize(variant.sku) === parentSku,
        ),
    )
  ) {
    errors.sku = 'SKU must be unique in this workspace.'
  }

  const variantSkus = (input.variants ?? [])
    .map((variant) => normalize(variant.sku))
    .filter(Boolean)
  const duplicateVariantSku = variantSkus.find(
    (sku, index) => variantSkus.indexOf(sku) !== index || sku === parentSku,
  )
  if (duplicateVariantSku) {
    errors.variants = 'Variant SKUs must be unique.'
  }
  if (
    (input.variants ?? []).length > COMMERCE_PRODUCT_VARIANT_LIMITS.maxVariants
  ) {
    errors.variants = `Products can have up to ${COMMERCE_PRODUCT_VARIANT_LIMITS.maxVariants} variants in preview.`
  }
  if (
    variantSkus.some((sku) =>
      scopedProducts.some(
        (product) =>
          normalize(product.sku) === sku ||
          product.variants.some((variant) => normalize(variant.sku) === sku),
      ),
    )
  ) {
    errors.variants = 'Variant SKUs must be unique in this workspace.'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

export function generateVariantCombinations(
  options: Array<{ name: string; values: string[] }>,
) {
  const normalizedOptions = options
    .map((option) => ({
      name: option.name.trim(),
      values: Array.from(
        option.values
          .map((value) => value.trim())
          .filter(Boolean)
          .reduce((values, value) => {
            const key = value.toLowerCase()
            if (!values.has(key)) values.set(key, value)
            return values
          }, new Map<string, string>())
          .values(),
      ),
    }))
    .filter((option) => option.name && option.values.length)
    .slice(0, COMMERCE_PRODUCT_VARIANT_LIMITS.maxOptionGroups)

  if (!normalizedOptions.length) return []
  const combinations: Array<Record<string, string>> = [{}]
  for (const option of normalizedOptions) {
    const next: Array<Record<string, string>> = []
    for (const combination of combinations) {
      for (const value of option.values) {
        next.push({ ...combination, [option.name]: value })
      }
    }
    combinations.splice(0, combinations.length, ...next)
  }
  if (combinations.length > COMMERCE_PRODUCT_VARIANT_LIMITS.maxVariants) {
    return null
  }
  return combinations
}
