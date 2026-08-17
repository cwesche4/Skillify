import type {
  CommerceActivity,
  CommerceAddress,
  CommerceCustomer,
  CommerceDiscountType,
  CommercePreviewSettings,
  CommerceCustomerStatus,
  CommerceCustomerType,
  CommerceOrderLine,
  CommerceFulfillment,
  CommerceOrder,
  CommerceOrderStatus,
  CommercePaymentStatus,
  CommerceProduct,
  CommerceProductStatus,
  CommerceProductVariant,
  CommerceFulfillmentPriority,
  CommerceFulfillmentStatus,
  CommerceShippingCostState,
  CommerceShippingPayer,
} from '@/lib/commerce/types'
import { normalizeDiscountType } from '@/lib/commerce/calculateOrderFinancials'
import { validateProductInput } from '@/lib/commerce/productCatalog'
import {
  calculateOrderLineTotals,
  calculateOrderTotals,
  normalizeCommerceAddress,
  validateOrderInput,
} from '@/lib/commerce/orderCatalog'
import {
  normalizeCustomerTagAssignments,
  normalizeCustomerTagLabel,
} from '@/lib/commerce/customerTagRegistry'
import { normalizeCustomerTypeAssignments } from '@/lib/commerce/customerTypeRegistry'
import {
  getPreviewCustomerTags,
  savePreviewCustomerTags,
} from '@/lib/commerce/previewCommerceTagStorage'
import {
  getPreviewCustomerTypes,
  savePreviewCustomerTypes,
} from '@/lib/commerce/previewCommerceCustomerTypeStorage'

export type CommercePreviewCollection =
  | 'customers'
  | 'products'
  | 'orders'
  | 'fulfillments'
  | 'activities'

type CommercePreviewDataMap = {
  customers: CommerceCustomer[]
  products: CommerceProduct[]
  orders: CommerceOrder[]
  fulfillments: CommerceFulfillment[]
  activities: CommerceActivity[]
}

type PreviewOrderInput = Omit<
  Partial<CommerceOrder>,
  'lines' | 'billingAddress' | 'shippingAddress'
> & {
  lines?: Array<Partial<CommerceOrderLine>>
  billingAddress?: Partial<CommerceAddress>
  shippingAddress?: Partial<CommerceAddress>
  inlineCustomer?: Partial<CommerceCustomer>
}

export type VersionedCommercePreviewShape<T> = {
  version: 1
  workspaceId: string
  records: T[]
}

export function getCommercePreviewStorageKey({
  workspaceId,
  collection,
}: {
  workspaceId: string
  collection: CommercePreviewCollection
}) {
  return `skillify-preview-commerce:${workspaceId}:${collection}:v1`
}

export function getCommercePreviewSettingsStorageKey(workspaceId: string) {
  return `skillify-preview-commerce:${workspaceId}:settings:v1`
}

export function parseCommercePreviewRecords<T>(
  rawValue: string | null | undefined,
  workspaceId: string,
): T[] {
  if (!rawValue) return []
  try {
    const parsed = JSON.parse(rawValue) as Partial<
      VersionedCommercePreviewShape<T>
    >
    if (
      parsed?.version !== 1 ||
      parsed.workspaceId !== workspaceId ||
      !Array.isArray(parsed.records)
    ) {
      return []
    }
    return parsed.records
  } catch {
    return []
  }
}

export function createEmptyCommercePreviewShape<T>(
  workspaceId: string,
): VersionedCommercePreviewShape<T> {
  return {
    version: 1,
    workspaceId,
    records: [],
  }
}

export function createDefaultCommercePreviewSettings(
  workspaceId: string,
): CommercePreviewSettings {
  return {
    workspaceId,
    shippingDefaults: {
      payer: 'CUSTOMER',
      method: undefined,
      carrier: undefined,
      shippingCharge: undefined,
      shippingCost: undefined,
    },
    updatedAt: nowIso(),
  }
}

export function normalizeCommercePreviewSettings(
  settings: Partial<CommercePreviewSettings> | null | undefined,
  workspaceId: string,
): CommercePreviewSettings {
  const defaults = createDefaultCommercePreviewSettings(workspaceId)
  return {
    workspaceId,
    shippingDefaults: {
      payer: normalizeShippingPayer(settings?.shippingDefaults?.payer),
      method:
        settings?.shippingDefaults?.method?.trim() ||
        defaults.shippingDefaults.method,
      carrier:
        settings?.shippingDefaults?.carrier?.trim() ||
        defaults.shippingDefaults.carrier,
      shippingCharge:
        settings?.shippingDefaults?.shippingCharge == null
          ? defaults.shippingDefaults.shippingCharge
          : Math.max(0, Number(settings.shippingDefaults.shippingCharge)),
      shippingCost:
        settings?.shippingDefaults?.shippingCost == null
          ? defaults.shippingDefaults.shippingCost
          : Math.max(0, Number(settings.shippingDefaults.shippingCost)),
    },
    updatedAt: settings?.updatedAt ?? defaults.updatedAt,
  }
}

export function readCommercePreviewRecords<
  TCollection extends CommercePreviewCollection,
>({
  workspaceId,
  collection,
  storage,
}: {
  workspaceId: string
  collection: TCollection
  storage?: Pick<Storage, 'getItem'> | null
}): CommercePreviewDataMap[TCollection] {
  if (!storage) return [] as CommercePreviewDataMap[TCollection]
  return parseCommercePreviewRecords<
    CommercePreviewDataMap[TCollection][number]
  >(
    storage.getItem(getCommercePreviewStorageKey({ workspaceId, collection })),
    workspaceId,
  ) as CommercePreviewDataMap[TCollection]
}

export function getPreviewCommerceSettings(
  workspaceId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  if (!storage) return createDefaultCommercePreviewSettings(workspaceId)
  try {
    const parsed = JSON.parse(
      storage.getItem(getCommercePreviewSettingsStorageKey(workspaceId)) ?? '',
    ) as Partial<{
      version: 1
      workspaceId: string
      settings: Partial<CommercePreviewSettings>
    }>
    if (parsed.version !== 1 || parsed.workspaceId !== workspaceId) {
      return createDefaultCommercePreviewSettings(workspaceId)
    }
    return normalizeCommercePreviewSettings(parsed.settings, workspaceId)
  } catch {
    return createDefaultCommercePreviewSettings(workspaceId)
  }
}

export function savePreviewCommerceSettings({
  workspaceId,
  settings,
  storage,
}: {
  workspaceId: string
  settings: Partial<CommercePreviewSettings>
  storage?: Storage | null
}) {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
  const normalized = normalizeCommercePreviewSettings(
    {
      ...settings,
      updatedAt: nowIso(),
    },
    workspaceId,
  )
  if (targetStorage) {
    targetStorage.setItem(
      getCommercePreviewSettingsStorageKey(workspaceId),
      JSON.stringify({
        version: 1,
        workspaceId,
        settings: normalized,
      }),
    )
  }
  notifyCollectionChanged(commercePreviewSettingsChangedEvent, workspaceId)
  return normalized
}

export const commercePreviewProductsChangedEvent =
  'skillify-preview-commerce-products-changed'
export const commercePreviewCustomersChangedEvent =
  'skillify-preview-commerce-customers-changed'
export const commercePreviewOrdersChangedEvent =
  'skillify-preview-commerce-orders-changed'
export const commercePreviewFulfillmentsChangedEvent =
  'skillify-preview-commerce-fulfillments-changed'
export const commercePreviewSettingsChangedEvent =
  'skillify-preview-commerce-settings-changed'

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createStablePreviewId(
  prefix: string,
  parts: Array<string | undefined>,
) {
  const slug = parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug ? `${prefix}_${slug}` : createId(prefix)
}

function writeCommercePreviewRecords<
  TCollection extends CommercePreviewCollection,
>({
  workspaceId,
  collection,
  records,
  storage,
}: {
  workspaceId: string
  collection: TCollection
  records: CommercePreviewDataMap[TCollection]
  storage?: Pick<Storage, 'setItem'> | null
}) {
  if (!storage) return
  storage.setItem(
    getCommercePreviewStorageKey({ workspaceId, collection }),
    JSON.stringify({
      version: 1,
      workspaceId,
      records,
    } satisfies VersionedCommercePreviewShape<
      CommercePreviewDataMap[TCollection][number]
    >),
  )
}

function notifyProductsChanged(workspaceId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(commercePreviewProductsChangedEvent, {
      detail: { workspaceId },
    }),
  )
}

function notifyCollectionChanged(eventName: string, workspaceId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: { workspaceId },
    }),
  )
}

export function normalizePreviewProduct(
  product: Partial<CommerceProduct>,
  workspaceId: string,
): CommerceProduct {
  const id = product.id ?? createId('prod')
  const createdAt = product.createdAt ?? nowIso()
  const updatedAt = product.updatedAt ?? createdAt
  const price = {
    amount: Number(product.price?.amount ?? 0),
    currency: product.price?.currency ?? 'USD',
  }
  const variants = (product.variants ?? []).map((variant) =>
    normalizePreviewVariant(variant, workspaceId, id),
  )
  return {
    id,
    workspaceId,
    name: product.name?.trim() || 'Untitled Product',
    description: product.description?.trim() || undefined,
    slug: product.slug,
    sku: product.sku?.trim() || undefined,
    barcode: product.barcode?.trim() || undefined,
    status: product.status ?? 'DRAFT',
    category: product.category?.trim() || undefined,
    vendor: product.vendor?.trim() || undefined,
    price,
    compareAtPrice: product.compareAtPrice
      ? {
          amount: Number(product.compareAtPrice.amount ?? 0),
          currency: product.compareAtPrice.currency ?? price.currency,
        }
      : undefined,
    cost: product.cost
      ? {
          amount: Number(product.cost.amount ?? 0),
          currency: product.cost.currency ?? price.currency,
        }
      : undefined,
    taxable: product.taxable ?? true,
    trackInventory: product.trackInventory ?? false,
    inventoryQuantity:
      typeof product.inventoryQuantity === 'number'
        ? product.inventoryQuantity
        : undefined,
    lowStockThreshold:
      typeof product.lowStockThreshold === 'number'
        ? product.lowStockThreshold
        : undefined,
    hasVariants: product.hasVariants ?? variants.length > 0,
    variants,
    imageUrl: product.imageUrl?.trim() || undefined,
    tags: product.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
    productNotes: product.productNotes?.trim() || undefined,
    createdAt,
    updatedAt,
    archivedAt: product.archivedAt,
  }
}

function normalizePreviewVariant(
  variant: Partial<CommerceProductVariant>,
  workspaceId: string,
  productId: string,
): CommerceProductVariant {
  const createdAt = variant.createdAt ?? nowIso()
  return {
    id: variant.id ?? createId('var'),
    workspaceId,
    productId,
    name: variant.name?.trim() || 'Variant',
    optionValues: variant.optionValues ?? {},
    sku: variant.sku?.trim() || undefined,
    barcode: variant.barcode?.trim() || undefined,
    status: variant.status ?? 'DRAFT',
    price: variant.price
      ? {
          amount: Number(variant.price.amount ?? 0),
          currency: variant.price.currency ?? 'USD',
        }
      : undefined,
    cost: variant.cost
      ? {
          amount: Number(variant.cost.amount ?? 0),
          currency: variant.cost.currency ?? variant.price?.currency ?? 'USD',
        }
      : undefined,
    inventoryQuantity:
      typeof variant.inventoryQuantity === 'number'
        ? variant.inventoryQuantity
        : undefined,
    createdAt,
    updatedAt: variant.updatedAt ?? createdAt,
  }
}

function normalizeOrderStatus(status: unknown): CommerceOrderStatus {
  if (status === 'NEW') return 'PENDING'
  if (
    status === 'DRAFT' ||
    status === 'PENDING' ||
    status === 'CONFIRMED' ||
    status === 'PROCESSING' ||
    status === 'COMPLETED' ||
    status === 'CANCELLED'
  ) {
    return status
  }
  return 'DRAFT'
}

function normalizePaymentStatus(status: unknown): CommercePaymentStatus {
  if (status === 'AUTHORIZED') return 'PENDING'
  if (status === 'FAILED') return 'UNPAID'
  if (
    status === 'UNPAID' ||
    status === 'PENDING' ||
    status === 'PAID' ||
    status === 'REFUNDED' ||
    status === 'PARTIALLY_REFUNDED'
  ) {
    return status
  }
  return 'UNPAID'
}

function normalizeFulfillmentStatus(
  status: unknown,
): CommerceFulfillmentStatus {
  if (status === 'READY_TO_PICK') return 'PICKING'
  if (status === 'PACKED') return 'PACKING'
  if (status === 'ON_HOLD') return 'UNFULFILLED'
  if (
    status === 'UNFULFILLED' ||
    status === 'PICKING' ||
    status === 'PACKING' ||
    status === 'READY_TO_SHIP' ||
    status === 'SHIPPED' ||
    status === 'DELIVERED' ||
    status === 'RETURNED' ||
    status === 'CANCELLED'
  ) {
    return status
  }
  return 'UNFULFILLED'
}

function normalizeFulfillmentPriority(
  priority: unknown,
): CommerceFulfillmentPriority {
  if (
    priority === 'LOW' ||
    priority === 'MEDIUM' ||
    priority === 'HIGH' ||
    priority === 'URGENT'
  ) {
    return priority
  }
  return 'MEDIUM'
}

function normalizeCustomerStatus(status: unknown): CommerceCustomerStatus {
  if (
    status === 'NEW' ||
    status === 'ACTIVE' ||
    status === 'AT_RISK' ||
    status === 'INACTIVE'
  ) {
    return status
  }
  if (status === 'REPEAT' || status === 'VIP') return 'ACTIVE'
  return 'NEW'
}

function normalizeCustomerType(
  type: unknown,
): CommerceCustomerType | undefined {
  if (
    type === 'RESIDENTIAL' ||
    type === 'COMMERCIAL' ||
    type === 'RETAIL' ||
    type === 'WHOLESALE' ||
    type === 'DISTRIBUTOR' ||
    type === 'GOVERNMENT' ||
    type === 'NONPROFIT' ||
    type === 'EMPLOYEE' ||
    type === 'INTERNAL'
  ) {
    return type
  }
  return undefined
}

function normalizeCustomerTags(
  customer: Partial<CommerceCustomer> & {
    customerType?: unknown
    customerTypeId?: unknown
  },
) {
  const rawStatus = customer.lifecycleStatus as unknown
  const rawCustomerType = customer.customerType as unknown
  const tags = new Map<string, string>()
  for (const tag of customer.tags ?? []) {
    const label = String(tag ?? '').trim()
    if (!label) continue
    tags.set(normalizeCustomerTagLabel(label), label)
  }
  if (rawStatus === 'VIP' || rawCustomerType === 'VIP') {
    tags.set('vip', 'VIP')
  }
  return Array.from(tags.values())
}

function normalizeShippingPayer(payer: unknown): CommerceShippingPayer {
  return payer === 'BUSINESS' ? 'BUSINESS' : 'CUSTOMER'
}

function normalizeShippingCostState(
  state: unknown,
): CommerceShippingCostState | undefined {
  if (state === 'ACTUAL' || state === 'ESTIMATED') return state
  return undefined
}

function normalizeLineDiscountType(
  line: Partial<CommerceOrderLine>,
): CommerceDiscountType {
  if (line.discountType) return normalizeDiscountType(line.discountType)
  return Number(line.discountTotal ?? 0) > 0 ? 'FIXED_AMOUNT' : 'NONE'
}

export function normalizePreviewCustomer(
  customer: Partial<CommerceCustomer> & {
    customerType?: unknown
    customerTypeId?: unknown
  },
  workspaceId: string,
): CommerceCustomer {
  const createdAt = customer.createdAt ?? nowIso()
  const billingAddress = normalizeCommerceAddress(customer.billingAddress)
  const shippingAddress = normalizeCommerceAddress(customer.shippingAddress)
  const rawCustomerType = customer.customerType as unknown
  const legacyType =
    rawCustomerType === 'INACTIVE' ||
    rawCustomerType === 'NEW' ||
    rawCustomerType === 'RETURNING' ||
    rawCustomerType === 'VIP'
  const lifecycleStatus =
    rawCustomerType === 'INACTIVE' && !customer.lifecycleStatus
      ? 'INACTIVE'
      : normalizeCustomerStatus(customer.lifecycleStatus)
  const normalizedCustomerType = normalizeCustomerType(customer.customerType)
  const legacyCustomerTypeName =
    !legacyType &&
    !normalizedCustomerType &&
    typeof rawCustomerType === 'string' &&
    rawCustomerType.trim()
      ? rawCustomerType.trim()
      : customer.legacyCustomerTypeName?.trim() || undefined
  return {
    id: customer.id ?? createId('cust'),
    workspaceId,
    relationshipKind: customer.relationshipKind ?? 'COMMERCE_CUSTOMER',
    sharedIdentityId: customer.sharedIdentityId,
    displayName: customer.displayName?.trim() || 'Unnamed Customer',
    companyName: customer.companyName?.trim() || undefined,
    email: customer.email?.trim() || undefined,
    phone: customer.phone?.trim() || undefined,
    lifecycleStatus,
    customerTypeId:
      typeof customer.customerTypeId === 'string' &&
      customer.customerTypeId.trim()
        ? customer.customerTypeId.trim()
        : undefined,
    customerType: legacyType ? undefined : normalizedCustomerType,
    legacyCustomerTypeName,
    tags: normalizeCustomerTags(customer),
    billingAddress,
    shippingAddress,
    defaultShippingAddress:
      customer.defaultShippingAddress === 'BILLING' ? 'BILLING' : 'SHIPPING',
    clientNotes: customer.clientNotes?.trim() || undefined,
    internalNotes: customer.internalNotes?.trim() || undefined,
    archivedAt: customer.archivedAt,
    createdAt,
    updatedAt: customer.updatedAt ?? createdAt,
  }
}

function normalizePreviewOrderLine(
  line: Partial<CommerceOrderLine>,
  orderId: string,
): CommerceOrderLine {
  const totals = calculateOrderLineTotals(line)
  const discountType = normalizeLineDiscountType(line)
  const discountValue =
    discountType === 'NONE'
      ? 0
      : Math.max(
          0,
          Number(
            line.discountValue ??
              line.resolvedDiscountAmount ??
              line.discountTotal ??
              0,
          ),
        )
  return {
    id: line.id ?? createId('line'),
    orderId,
    productId: line.productId,
    variantId: line.variantId,
    name: line.name?.trim() || 'Custom item',
    sku: line.sku?.trim() || undefined,
    quantity: Math.max(0, Number(line.quantity ?? 1)),
    unitPrice: Math.max(0, Number(line.unitPrice ?? 0)),
    unitCost:
      line.unitCost == null || !Number.isFinite(Number(line.unitCost))
        ? undefined
        : Math.max(0, Number(line.unitCost)),
    discountType,
    discountValue,
    resolvedDiscountAmount: totals.discountTotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    subtotal: totals.subtotal,
    lineTotal: totals.lineTotal,
  }
}

function createOrderNumber(orders: CommerceOrder[]) {
  const largest = orders.reduce((highest, order) => {
    const parsed = Number(order.orderNumber.replace(/\D/g, ''))
    return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest
  }, 1000)
  return `ORD-${String(largest + 1).padStart(5, '0')}`
}

function createFulfillmentNumber(fulfillments: CommerceFulfillment[]) {
  const largest = fulfillments.reduce((highest, fulfillment) => {
    const parsed = Number(fulfillment.fulfillmentNumber.replace(/\D/g, ''))
    return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest
  }, 1000)
  return `FUL-${String(largest + 1).padStart(5, '0')}`
}

export function normalizePreviewFulfillment(
  fulfillment: Partial<CommerceFulfillment>,
  workspaceId: string,
): CommerceFulfillment {
  const id =
    fulfillment.id?.trim() ||
    createStablePreviewId('ful', [
      fulfillment.fulfillmentNumber,
      fulfillment.orderId,
      fulfillment.customerId,
    ])
  const createdAt = fulfillment.createdAt ?? nowIso()
  return {
    id,
    workspaceId,
    fulfillmentNumber: fulfillment.fulfillmentNumber?.trim() || 'FUL-00000',
    orderId: fulfillment.orderId?.trim() || '',
    customerId: fulfillment.customerId?.trim() || undefined,
    status: normalizeFulfillmentStatus(fulfillment.status),
    priority: normalizeFulfillmentPriority(fulfillment.priority),
    assignedTo: fulfillment.assignedTo?.trim() || undefined,
    shippingMethod: fulfillment.shippingMethod?.trim() || undefined,
    trackingNumber: fulfillment.trackingNumber?.trim() || undefined,
    carrier: fulfillment.carrier?.trim() || undefined,
    estimatedDelivery: fulfillment.estimatedDelivery?.trim() || undefined,
    shippedAt: fulfillment.shippedAt?.trim() || undefined,
    deliveredAt: fulfillment.deliveredAt?.trim() || undefined,
    internalNotes: fulfillment.internalNotes?.trim() || undefined,
    customerNotesSnapshot:
      fulfillment.customerNotesSnapshot?.trim() || undefined,
    createdAt,
    updatedAt: fulfillment.updatedAt ?? createdAt,
  }
}

export function normalizePreviewOrder(
  order: PreviewOrderInput,
  workspaceId: string,
): CommerceOrder {
  const id = order.id ?? createId('ord')
  const createdAt = order.createdAt ?? nowIso()
  const lines = (order.lines ?? []).map((line) =>
    normalizePreviewOrderLine(line, id),
  )
  const totals = calculateOrderTotals({
    lines,
    shippingCharge: order.shippingCharge ?? order.shippingTotal,
    shippingCost: order.shippingCost,
    shippingPayer: normalizeShippingPayer(order.shippingPayer),
  })
  return {
    id,
    workspaceId,
    orderNumber: order.orderNumber?.trim() || 'ORD-00000',
    customerId: order.customerId,
    customerSnapshot: order.customerSnapshot,
    status: normalizeOrderStatus(order.status),
    paymentStatus: normalizePaymentStatus(order.paymentStatus),
    fulfillmentStatus: normalizeFulfillmentStatus(order.fulfillmentStatus),
    currency: order.currency?.trim().toUpperCase() || 'USD',
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    shippingTotal: totals.shippingTotal,
    shippingCharge: totals.shippingTotal,
    shippingCost:
      order.shippingCost == null || !Number.isFinite(Number(order.shippingCost))
        ? undefined
        : Math.max(0, Number(order.shippingCost)),
    shippingCostState:
      normalizeShippingCostState(order.shippingCostState) ??
      (order.shippingCost == null ? undefined : 'ESTIMATED'),
    shippingPayer: normalizeShippingPayer(order.shippingPayer),
    total: totals.total,
    lines,
    billingAddress: normalizeCommerceAddress(order.billingAddress),
    shippingAddress: normalizeCommerceAddress(order.shippingAddress),
    shippingSameAsBilling: order.shippingSameAsBilling ?? false,
    shippingMethod: order.shippingMethod?.trim() || undefined,
    shippingCarrier: order.shippingCarrier?.trim() || undefined,
    trackingNumber: order.trackingNumber?.trim() || undefined,
    estimatedDelivery: order.estimatedDelivery?.trim() || undefined,
    source: order.source ?? 'MANUAL',
    externalId: order.externalId?.trim() || undefined,
    sourceStoreId: order.sourceStoreId?.trim() || undefined,
    rawMetadata:
      order.rawMetadata && typeof order.rawMetadata === 'object'
        ? order.rawMetadata
        : undefined,
    orderNotes: order.orderNotes?.trim() || undefined,
    customerNotesSnapshot: order.customerNotesSnapshot?.trim() || undefined,
    archivedAt: order.archivedAt,
    cancelledAt: order.cancelledAt,
    createdAt,
    updatedAt: order.updatedAt ?? createdAt,
  }
}

function readActivities({
  workspaceId,
  storage,
}: {
  workspaceId: string
  storage?: Storage | null
}) {
  return readCommercePreviewRecords({
    workspaceId,
    collection: 'activities',
    storage,
  })
}

export function getPreviewCustomers(
  workspaceId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  return readCommercePreviewRecords({
    workspaceId,
    collection: 'customers',
    storage,
  })
    .filter((customer) => customer.workspaceId === workspaceId)
    .map((customer) => normalizePreviewCustomer(customer, workspaceId))
}

function savePreviewCustomers(
  workspaceId: string,
  customers: CommerceCustomer[],
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  writeCommercePreviewRecords({
    workspaceId,
    collection: 'customers',
    records: customers,
    storage,
  })
  notifyCollectionChanged(commercePreviewCustomersChangedEvent, workspaceId)
}

export function migratePreviewCustomerTags({
  workspaceId,
  storage,
}: {
  workspaceId: string
  storage?: Storage | null
}) {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
  const customers = getPreviewCustomers(workspaceId, targetStorage)
  const tags = getPreviewCustomerTags(workspaceId, targetStorage)
  const result = normalizeCustomerTagAssignments({
    customers,
    tags,
    workspaceId,
    now: nowIso(),
  })
  if (result.changed) {
    savePreviewCustomers(workspaceId, result.customers, targetStorage)
    savePreviewCustomerTags({
      workspaceId,
      tags: result.tags,
      storage: targetStorage,
    })
  }
  return result
}

export function migratePreviewCustomerTypes({
  workspaceId,
  storage,
}: {
  workspaceId: string
  storage?: Storage | null
}) {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
  const customers = getPreviewCustomers(workspaceId, targetStorage)
  const types = getPreviewCustomerTypes(workspaceId, targetStorage)
  const result = normalizeCustomerTypeAssignments({
    customers,
    types,
    workspaceId,
    now: nowIso(),
  })
  if (result.changed) {
    savePreviewCustomers(workspaceId, result.customers, targetStorage)
    savePreviewCustomerTypes({
      workspaceId,
      types: result.types,
      storage: targetStorage,
    })
  }
  return result
}

export function removeCustomerTagFromAllCustomers({
  workspaceId,
  tagId,
  storage,
}: {
  workspaceId: string
  tagId: string
  storage?: Storage | null
}) {
  const customers = getPreviewCustomers(workspaceId, storage)
  const nextCustomers = customers.map((customer) => ({
    ...customer,
    tags: (customer.tags ?? []).filter((tag) => tag !== tagId),
    updatedAt: (customer.tags ?? []).includes(tagId)
      ? nowIso()
      : customer.updatedAt,
  }))
  savePreviewCustomers(workspaceId, nextCustomers, storage)
  return nextCustomers
}

function findCustomerByEmail(
  customers: CommerceCustomer[],
  email: string | undefined,
  ignoredCustomerId?: string,
) {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return undefined
  return customers.find(
    (customer) =>
      customer.id !== ignoredCustomerId &&
      customer.email?.trim().toLowerCase() === normalizedEmail,
  )
}

export function createCustomerActivity({
  workspaceId,
  customerId,
  title,
  description,
}: {
  workspaceId: string
  customerId: string
  title: string
  description?: string
}): CommerceActivity {
  return {
    id: createId('act'),
    workspaceId,
    recordId: customerId,
    recordType: 'customer',
    title,
    description,
    createdAt: nowIso(),
  }
}

export function createPreviewCustomer({
  workspaceId,
  input,
  storage,
}: {
  workspaceId: string
  input: Partial<CommerceCustomer>
  storage?: Storage | null
}) {
  const customers = getPreviewCustomers(workspaceId, storage)
  const duplicate = findCustomerByEmail(customers, input.email)
  if (duplicate) {
    return {
      customer: duplicate,
      errors: { email: 'A customer with this email already exists.' },
    }
  }
  const customer = normalizePreviewCustomer(
    {
      ...input,
      id: createId('cust'),
      workspaceId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    workspaceId,
  )
  savePreviewCustomers(workspaceId, [customer, ...customers], storage)
  appendCommerceActivity(
    workspaceId,
    createCustomerActivity({
      workspaceId,
      customerId: customer.id,
      title: 'Customer created',
    }),
    storage,
  )
  return { customer, errors: {} }
}

export function updatePreviewCustomer({
  workspaceId,
  customerId,
  changes,
  storage,
}: {
  workspaceId: string
  customerId: string
  changes: Partial<CommerceCustomer>
  storage?: Storage | null
}) {
  const customers = getPreviewCustomers(workspaceId, storage)
  const customer = customers.find((record) => record.id === customerId)
  if (!customer) {
    return { customer: null, errors: { customer: 'Customer not found.' } }
  }
  const duplicate = findCustomerByEmail(
    customers,
    changes.email ?? customer.email,
    customer.id,
  )
  if (duplicate) {
    return {
      customer: null,
      errors: { email: 'A customer with this email already exists.' },
    }
  }
  const nextCustomer = normalizePreviewCustomer(
    {
      ...customer,
      ...changes,
      id: customer.id,
      workspaceId,
      updatedAt: nowIso(),
    },
    workspaceId,
  )
  savePreviewCustomers(
    workspaceId,
    customers.map((record) =>
      record.id === customerId ? nextCustomer : record,
    ),
    storage,
  )
  appendCommerceActivity(
    workspaceId,
    createCustomerActivity({
      workspaceId,
      customerId,
      title:
        customer.clientNotes !== nextCustomer.clientNotes
          ? 'Customer Notes updated'
          : 'Customer updated',
    }),
    storage,
  )
  return { customer: nextCustomer, errors: {} }
}

export function archivePreviewCustomer({
  workspaceId,
  customerId,
  storage,
}: {
  workspaceId: string
  customerId: string
  storage?: Storage | null
}) {
  return updatePreviewCustomer({
    workspaceId,
    customerId,
    changes: { lifecycleStatus: 'INACTIVE', archivedAt: nowIso() },
    storage,
  })
}

export function deletePreviewCustomer({
  workspaceId,
  customerId,
  storage,
}: {
  workspaceId: string
  customerId: string
  storage?: Storage | null
}) {
  const customers = getPreviewCustomers(workspaceId, storage)
  const exists = customers.some((customer) => customer.id === customerId)
  if (!exists) {
    return { deleted: false, errors: { customer: 'Customer not found.' } }
  }
  savePreviewCustomers(
    workspaceId,
    customers.filter((customer) => customer.id !== customerId),
    storage,
  )
  return { deleted: true, errors: {} }
}

export function getPreviewCustomerActivities(
  workspaceId: string,
  customerId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  return readActivities({ workspaceId, storage })
    .filter(
      (activity) =>
        activity.workspaceId === workspaceId &&
        activity.recordType === 'customer' &&
        activity.recordId === customerId,
    )
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    )
}

export function appendCommerceActivity(
  workspaceId: string,
  activity: CommerceActivity,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  const activities = readActivities({ workspaceId, storage })
  writeCommercePreviewRecords({
    workspaceId,
    collection: 'activities',
    records: [...activities, activity],
    storage,
  })
}

export function getPreviewOrders(
  workspaceId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  return readCommercePreviewRecords({
    workspaceId,
    collection: 'orders',
    storage,
  })
    .filter((order) => order.workspaceId === workspaceId)
    .map((order) => normalizePreviewOrder(order, workspaceId))
}

export function getPreviewOrder(
  workspaceId: string,
  orderId: string,
  storage?: Storage | null,
) {
  return getPreviewOrders(workspaceId, storage).find(
    (order) => order.id === orderId,
  )
}

function savePreviewOrders(
  workspaceId: string,
  orders: CommerceOrder[],
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  writeCommercePreviewRecords({
    workspaceId,
    collection: 'orders',
    records: orders,
    storage,
  })
  notifyCollectionChanged(commercePreviewOrdersChangedEvent, workspaceId)
}

export function createOrderActivity({
  workspaceId,
  orderId,
  title,
  description,
}: {
  workspaceId: string
  orderId: string
  title: string
  description?: string
}): CommerceActivity {
  return {
    id: createId('act'),
    workspaceId,
    recordId: orderId,
    recordType: 'order',
    title,
    description,
    createdAt: nowIso(),
  }
}

export function getPreviewOrderActivities(
  workspaceId: string,
  orderId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  return readActivities({ workspaceId, storage })
    .filter(
      (activity) =>
        activity.workspaceId === workspaceId &&
        activity.recordType === 'order' &&
        activity.recordId === orderId,
    )
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    )
}

function resolveOrderCustomerSnapshot(
  order: PreviewOrderInput,
  customer?: CommerceCustomer | null,
) {
  return (
    order.customerSnapshot ??
    (customer
      ? {
          displayName: customer.displayName,
          companyName: customer.companyName,
          email: customer.email,
          phone: customer.phone,
        }
      : undefined)
  )
}

export function createPreviewOrder({
  workspaceId,
  input,
  storage,
}: {
  workspaceId: string
  input: PreviewOrderInput
  storage?: Storage | null
}) {
  const orders = getPreviewOrders(workspaceId, storage)
  const customers = getPreviewCustomers(workspaceId, storage)
  const products = getPreviewProducts(workspaceId, storage)
  const validation = validateOrderInput({
    input,
    customers,
    products,
    workspaceId,
  })
  if (!validation.valid)
    return { order: null, customer: null, errors: validation.errors }

  let customer = input.customerId
    ? customers.find((record) => record.id === input.customerId)
    : null
  if (!customer && input.inlineCustomer) {
    const result = createPreviewCustomer({
      workspaceId,
      input: input.inlineCustomer,
      storage,
    })
    customer = result.customer
  }

  const createdAt = nowIso()
  const order = normalizePreviewOrder(
    {
      ...input,
      id: createId('ord'),
      workspaceId,
      orderNumber: input.orderNumber ?? createOrderNumber(orders),
      customerId: customer?.id ?? input.customerId,
      customerSnapshot: resolveOrderCustomerSnapshot(input, customer),
      status: input.status ?? 'DRAFT',
      paymentStatus: input.paymentStatus ?? 'UNPAID',
      fulfillmentStatus: input.fulfillmentStatus ?? 'UNFULFILLED',
      createdAt,
      updatedAt: createdAt,
    },
    workspaceId,
  )
  savePreviewOrders(workspaceId, [order, ...orders], storage)
  appendCommerceActivity(
    workspaceId,
    createOrderActivity({
      workspaceId,
      orderId: order.id,
      title: 'Order created',
      description: `${order.lines.length} item${order.lines.length === 1 ? '' : 's'}`,
    }),
    storage,
  )
  return { order, customer, errors: {} }
}

export function updatePreviewOrder({
  workspaceId,
  orderId,
  changes,
  activity,
  storage,
}: {
  workspaceId: string
  orderId: string
  changes: PreviewOrderInput
  activity?: false | { title: string; description?: string }
  storage?: Storage | null
}) {
  const orders = getPreviewOrders(workspaceId, storage)
  const order = orders.find((record) => record.id === orderId)
  if (!order) return { order: null, errors: { order: 'Order not found.' } }
  const customers = getPreviewCustomers(workspaceId, storage)
  const products = getPreviewProducts(workspaceId, storage)
  const customer =
    (changes.customerId ?? order.customerId)
      ? customers.find(
          (record) => record.id === (changes.customerId ?? order.customerId),
        )
      : null
  const nextOrder = normalizePreviewOrder(
    {
      ...order,
      ...changes,
      id: order.id,
      workspaceId,
      customerSnapshot:
        resolveOrderCustomerSnapshot(changes, customer) ??
        order.customerSnapshot,
      updatedAt: nowIso(),
    },
    workspaceId,
  )
  const validation = validateOrderInput({
    input: nextOrder,
    customers,
    products,
    workspaceId,
  })
  if (!validation.valid) return { order: null, errors: validation.errors }
  savePreviewOrders(
    workspaceId,
    orders.map((record) => (record.id === orderId ? nextOrder : record)),
    storage,
  )
  if (activity !== false) {
    appendCommerceActivity(
      workspaceId,
      createOrderActivity({
        workspaceId,
        orderId,
        title: activity?.title ?? resolveOrderUpdateActivity(order, nextOrder),
        description: activity?.description,
      }),
      storage,
    )
  }
  return { order: nextOrder, errors: {} }
}

function resolveOrderUpdateActivity(
  previous: CommerceOrder,
  next: CommerceOrder,
) {
  if (previous.status !== next.status) return 'Order status changed'
  if (previous.paymentStatus !== next.paymentStatus)
    return 'Payment status changed'
  if (previous.fulfillmentStatus !== next.fulfillmentStatus) {
    return 'Fulfillment status changed'
  }
  if (previous.lines.length !== next.lines.length) return 'Order items updated'
  if (previous.orderNotes !== next.orderNotes) return 'Order Notes updated'
  return 'Order updated'
}

export function duplicatePreviewOrder({
  workspaceId,
  orderId,
  storage,
}: {
  workspaceId: string
  orderId: string
  storage?: Storage | null
}) {
  const orders = getPreviewOrders(workspaceId, storage)
  const order = orders.find((record) => record.id === orderId)
  if (!order) return { order: null, errors: { order: 'Order not found.' } }
  return createPreviewOrder({
    workspaceId,
    input: {
      ...order,
      id: undefined,
      orderNumber: createOrderNumber(orders),
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'UNFULFILLED',
      archivedAt: undefined,
      cancelledAt: undefined,
      lines: order.lines.map((line) => ({ ...line, id: createId('line') })),
      orderNotes: order.orderNotes
        ? `${order.orderNotes}\nDuplicated from ${order.orderNumber}.`
        : `Duplicated from ${order.orderNumber}.`,
    },
    storage,
  })
}

export function archivePreviewOrder({
  workspaceId,
  orderId,
  storage,
}: {
  workspaceId: string
  orderId: string
  storage?: Storage | null
}) {
  return updatePreviewOrder({
    workspaceId,
    orderId,
    changes: { archivedAt: nowIso() },
    storage,
  })
}

export function cancelPreviewOrder({
  workspaceId,
  orderId,
  storage,
}: {
  workspaceId: string
  orderId: string
  storage?: Storage | null
}) {
  return updatePreviewOrder({
    workspaceId,
    orderId,
    changes: { status: 'CANCELLED', cancelledAt: nowIso() },
    storage,
  })
}

export function getPreviewFulfillments(
  workspaceId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  const records = readCommercePreviewRecords({
    workspaceId,
    collection: 'fulfillments',
    storage,
  }).filter((fulfillment) => fulfillment.workspaceId === workspaceId)

  const normalized = records.map((fulfillment) =>
    normalizePreviewFulfillment(fulfillment, workspaceId),
  )

  const migrated = normalized.some((fulfillment, index) => {
    const original = records[index]
    return (
      !original?.id?.trim() ||
      original.id !== fulfillment.id ||
      original.workspaceId !== fulfillment.workspaceId
    )
  })

  if (migrated && storage) {
    writeCommercePreviewRecords({
      workspaceId,
      collection: 'fulfillments',
      records: normalized,
      storage,
    })
  }

  return normalized
}

export function getPreviewFulfillment(
  workspaceId: string,
  fulfillmentId: string,
  storage?: Storage | null,
) {
  return getPreviewFulfillments(workspaceId, storage).find(
    (fulfillment) => fulfillment.id === fulfillmentId,
  )
}

export function getActivePreviewFulfillmentsForOrder(
  workspaceId: string,
  orderId: string,
  storage?: Storage | null,
) {
  return getPreviewFulfillments(workspaceId, storage).filter(
    (fulfillment) =>
      fulfillment.orderId === orderId &&
      fulfillment.status !== 'CANCELLED' &&
      !fulfillment.fulfillmentNumber.toLowerCase().includes('archived'),
  )
}

function savePreviewFulfillments(
  workspaceId: string,
  fulfillments: CommerceFulfillment[],
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  writeCommercePreviewRecords({
    workspaceId,
    collection: 'fulfillments',
    records: fulfillments,
    storage,
  })
  notifyCollectionChanged(commercePreviewFulfillmentsChangedEvent, workspaceId)
}

export function createFulfillmentActivity({
  workspaceId,
  fulfillmentId,
  title,
  description,
}: {
  workspaceId: string
  fulfillmentId: string
  title: string
  description?: string
}): CommerceActivity {
  return {
    id: createId('act'),
    workspaceId,
    recordId: fulfillmentId,
    recordType: 'fulfillment',
    title,
    description,
    createdAt: nowIso(),
  }
}

export function getPreviewFulfillmentActivities(
  workspaceId: string,
  fulfillmentId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  return readActivities({ workspaceId, storage })
    .filter(
      (activity) =>
        activity.workspaceId === workspaceId &&
        activity.recordType === 'fulfillment' &&
        activity.recordId === fulfillmentId,
    )
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    )
}

function resolveFulfillmentUpdateActivity(
  previous: CommerceFulfillment,
  next: CommerceFulfillment,
) {
  if (previous.status !== next.status) return 'Fulfillment status updated'
  if (previous.assignedTo !== next.assignedTo) return 'Assigned'
  if (previous.trackingNumber !== next.trackingNumber) return 'Tracking added'
  if (previous.carrier !== next.carrier) return 'Carrier updated'
  if (previous.internalNotes !== next.internalNotes)
    return 'Internal notes updated'
  return 'Fulfillment updated'
}

function createFulfillmentFromOrderDefaults(order: CommerceOrder) {
  return {
    orderId: order.id,
    customerId: order.customerId,
    status: order.fulfillmentStatus,
    shippingMethod: order.shippingMethod,
    carrier: order.shippingCarrier,
    trackingNumber: order.trackingNumber,
    estimatedDelivery: order.estimatedDelivery,
    shippedAt:
      order.fulfillmentStatus === 'SHIPPED' ? order.updatedAt : undefined,
    deliveredAt:
      order.fulfillmentStatus === 'DELIVERED' ? order.updatedAt : undefined,
    customerNotesSnapshot: order.customerNotesSnapshot,
  } satisfies Partial<CommerceFulfillment>
}

export function createPreviewFulfillment({
  workspaceId,
  input,
  storage,
}: {
  workspaceId: string
  input: Partial<CommerceFulfillment>
  storage?: Storage | null
}) {
  const fulfillments = getPreviewFulfillments(workspaceId, storage)
  const orders = getPreviewOrders(workspaceId, storage)
  const order = orders.find((record) => record.id === input.orderId)
  if (!order) {
    return {
      fulfillment: null,
      errors: { orderId: 'Select an order to fulfill.' },
    }
  }
  const existing = fulfillments.find((record) => record.orderId === order.id)
  if (existing && !input.id) {
    return {
      fulfillment: null,
      errors: { orderId: 'This order already has a fulfillment record.' },
    }
  }
  const createdAt = nowIso()
  const fulfillment = normalizePreviewFulfillment(
    {
      ...createFulfillmentFromOrderDefaults(order),
      ...input,
      id: createId('ful'),
      workspaceId,
      fulfillmentNumber:
        input.fulfillmentNumber ?? createFulfillmentNumber(fulfillments),
      createdAt,
      updatedAt: createdAt,
    },
    workspaceId,
  )
  savePreviewFulfillments(workspaceId, [fulfillment, ...fulfillments], storage)
  appendCommerceActivity(
    workspaceId,
    createFulfillmentActivity({
      workspaceId,
      fulfillmentId: fulfillment.id,
      title: 'Fulfillment created',
      description: order.orderNumber,
    }),
    storage,
  )
  return { fulfillment, errors: {} }
}

export function ensurePreviewFulfillmentForOrder({
  workspaceId,
  orderId,
  storage,
}: {
  workspaceId: string
  orderId: string
  storage?: Storage | null
}) {
  const fulfillment = getPreviewFulfillments(workspaceId, storage).find(
    (record) => record.orderId === orderId,
  )
  if (fulfillment) return { fulfillment, errors: {} }
  return createPreviewFulfillment({
    workspaceId,
    input: { orderId },
    storage,
  })
}

export function updatePreviewFulfillment({
  workspaceId,
  fulfillmentId,
  changes,
  activity,
  storage,
}: {
  workspaceId: string
  fulfillmentId: string
  changes: Partial<CommerceFulfillment>
  activity?: false | { title: string; description?: string }
  storage?: Storage | null
}) {
  const fulfillments = getPreviewFulfillments(workspaceId, storage)
  const fulfillment = fulfillments.find((record) => record.id === fulfillmentId)
  if (!fulfillment) {
    return {
      fulfillment: null,
      errors: { fulfillment: 'Fulfillment not found.' },
    }
  }
  const orders = getPreviewOrders(workspaceId, storage)
  const order = orders.find(
    (record) => record.id === (changes.orderId ?? fulfillment.orderId),
  )
  if (!order) {
    return { fulfillment: null, errors: { orderId: 'Order not found.' } }
  }
  const nextFulfillment = normalizePreviewFulfillment(
    {
      ...fulfillment,
      ...changes,
      id: fulfillment.id,
      workspaceId,
      updatedAt: nowIso(),
    },
    workspaceId,
  )
  savePreviewFulfillments(
    workspaceId,
    fulfillments.map((record) =>
      record.id === fulfillmentId ? nextFulfillment : record,
    ),
    storage,
  )
  if (activity !== false) {
    appendCommerceActivity(
      workspaceId,
      createFulfillmentActivity({
        workspaceId,
        fulfillmentId,
        title:
          activity?.title ??
          resolveFulfillmentUpdateActivity(fulfillment, nextFulfillment),
        description: activity?.description,
      }),
      storage,
    )
  }
  return { fulfillment: nextFulfillment, errors: {} }
}

export function syncOrderFulfillmentStatusFromFulfillment({
  workspaceId,
  fulfillmentId,
  storage,
}: {
  workspaceId: string
  fulfillmentId: string
  storage?: Storage | null
}) {
  const fulfillment = getPreviewFulfillment(workspaceId, fulfillmentId, storage)
  if (!fulfillment) {
    return { order: null, errors: { fulfillment: 'Fulfillment not found.' } }
  }
  const order = getPreviewOrder(workspaceId, fulfillment.orderId, storage)
  if (!order) return { order: null, errors: { order: 'Order not found.' } }
  if (order.fulfillmentStatus === fulfillment.status) {
    return { order, errors: {} }
  }
  return updatePreviewOrder({
    workspaceId,
    orderId: order.id,
    changes: { fulfillmentStatus: fulfillment.status },
    activity: false,
    storage,
  })
}

export function syncSingleFulfillmentStatusFromOrder({
  workspaceId,
  orderId,
  storage,
}: {
  workspaceId: string
  orderId: string
  storage?: Storage | null
}) {
  const order = getPreviewOrder(workspaceId, orderId, storage)
  if (!order)
    return { fulfillment: null, errors: { order: 'Order not found.' } }
  const activeFulfillments = getActivePreviewFulfillmentsForOrder(
    workspaceId,
    orderId,
    storage,
  )
  if (activeFulfillments.length === 0) return { fulfillment: null, errors: {} }
  if (activeFulfillments.length > 1) {
    return {
      fulfillment: null,
      errors: {
        fulfillment:
          'Multiple active fulfillment records are connected to this order.',
      },
    }
  }
  const fulfillment = activeFulfillments[0]
  if (fulfillment.status === order.fulfillmentStatus) {
    return { fulfillment, errors: {} }
  }
  return updatePreviewFulfillment({
    workspaceId,
    fulfillmentId: fulfillment.id,
    changes: { status: order.fulfillmentStatus },
    activity: {
      title: 'Fulfillment status synchronized',
      description: `${order.orderNumber} now shows ${order.fulfillmentStatus}.`,
    },
    storage,
  })
}

export function getPreviewProducts(
  workspaceId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  return readCommercePreviewRecords({
    workspaceId,
    collection: 'products',
    storage,
  })
    .filter((product) => product.workspaceId === workspaceId)
    .map((product) => normalizePreviewProduct(product, workspaceId))
}

export function getPreviewProduct(
  workspaceId: string,
  productId: string,
  storage?: Storage | null,
) {
  return getPreviewProducts(workspaceId, storage).find(
    (product) => product.id === productId,
  )
}

function savePreviewProducts(
  workspaceId: string,
  products: CommerceProduct[],
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  writeCommercePreviewRecords({
    workspaceId,
    collection: 'products',
    records: products,
    storage,
  })
  notifyProductsChanged(workspaceId)
}

export function createProductActivity({
  workspaceId,
  productId,
  title,
  description,
}: {
  workspaceId: string
  productId: string
  title: string
  description?: string
}): CommerceActivity {
  return {
    id: createId('act'),
    workspaceId,
    recordId: productId,
    recordType: 'product',
    title,
    description,
    createdAt: nowIso(),
  }
}

export function getPreviewProductActivities(
  workspaceId: string,
  productId: string,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  return readActivities({ workspaceId, storage })
    .filter(
      (activity) =>
        activity.workspaceId === workspaceId &&
        activity.recordType === 'product' &&
        activity.recordId === productId,
    )
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    )
}

function appendProductActivity(
  workspaceId: string,
  activity: CommerceActivity,
  storage: Storage | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
) {
  const activities = readActivities({ workspaceId, storage })
  writeCommercePreviewRecords({
    workspaceId,
    collection: 'activities',
    records: [...activities, activity],
    storage,
  })
}

export function createPreviewProduct({
  workspaceId,
  input,
  storage,
}: {
  workspaceId: string
  input: Partial<CommerceProduct>
  storage?: Storage | null
}) {
  const products = getPreviewProducts(workspaceId, storage)
  const validation = validateProductInput({
    input,
    existingProducts: products,
    workspaceId,
  })
  if (!validation.valid) return { product: null, errors: validation.errors }
  const product = normalizePreviewProduct(
    {
      ...input,
      id: createId('prod'),
      workspaceId,
      status: input.status ?? 'DRAFT',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    workspaceId,
  )
  savePreviewProducts(workspaceId, [product, ...products], storage)
  appendProductActivity(
    workspaceId,
    createProductActivity({
      workspaceId,
      productId: product.id,
      title: 'Product created',
    }),
    storage,
  )
  return { product, errors: {} }
}

export function updatePreviewProduct({
  workspaceId,
  productId,
  changes,
  storage,
}: {
  workspaceId: string
  productId: string
  changes: Partial<CommerceProduct>
  storage?: Storage | null
}) {
  const products = getPreviewProducts(workspaceId, storage)
  const product = products.find((record) => record.id === productId)
  if (!product)
    return { product: null, errors: { product: 'Product not found.' } }
  const nextProduct = normalizePreviewProduct(
    {
      ...product,
      ...changes,
      id: product.id,
      workspaceId,
      updatedAt: nowIso(),
    },
    workspaceId,
  )
  const validation = validateProductInput({
    input: nextProduct,
    existingProducts: products,
    workspaceId,
    productId,
  })
  if (!validation.valid) return { product: null, errors: validation.errors }
  savePreviewProducts(
    workspaceId,
    products.map((record) => (record.id === productId ? nextProduct : record)),
    storage,
  )
  appendProductActivity(
    workspaceId,
    createProductActivity({
      workspaceId,
      productId,
      title: resolveProductUpdateActivity(product, nextProduct),
    }),
    storage,
  )
  return { product: nextProduct, errors: {} }
}

function resolveProductUpdateActivity(
  previous: CommerceProduct,
  next: CommerceProduct,
) {
  if (previous.price.amount !== next.price.amount) return 'Price updated'
  if (previous.cost?.amount !== next.cost?.amount) return 'Cost updated'
  if (previous.inventoryQuantity !== next.inventoryQuantity) {
    return 'Inventory updated'
  }
  if (previous.productNotes !== next.productNotes) {
    return 'Product Notes updated'
  }
  if (previous.status !== next.status) {
    if (next.status === 'ACTIVE') return 'Product activated'
    if (next.status === 'DRAFT') return 'Product moved to Draft'
    if (next.status === 'ARCHIVED') return 'Product archived'
  }
  return 'Product updated'
}

export function archivePreviewProduct({
  workspaceId,
  productId,
  storage,
}: {
  workspaceId: string
  productId: string
  storage?: Storage | null
}) {
  return updatePreviewProduct({
    workspaceId,
    productId,
    changes: {
      status: 'ARCHIVED' as CommerceProductStatus,
      archivedAt: nowIso(),
    },
    storage,
  })
}

export function restorePreviewProduct({
  workspaceId,
  productId,
  storage,
}: {
  workspaceId: string
  productId: string
  storage?: Storage | null
}) {
  return updatePreviewProduct({
    workspaceId,
    productId,
    changes: {
      status: 'DRAFT' as CommerceProductStatus,
      archivedAt: undefined,
    },
    storage,
  })
}

export function duplicatePreviewProduct({
  workspaceId,
  productId,
  storage,
}: {
  workspaceId: string
  productId: string
  storage?: Storage | null
}) {
  const products = getPreviewProducts(workspaceId, storage)
  const product = products.find((record) => record.id === productId)
  if (!product)
    return { product: null, errors: { product: 'Product not found.' } }
  const duplicated = normalizePreviewProduct(
    {
      ...product,
      id: createId('prod'),
      name: `${product.name} - Copy`,
      sku: undefined,
      status: 'DRAFT',
      productNotes: undefined,
      archivedAt: undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      variants: product.variants.map((variant) => ({
        ...variant,
        id: createId('var'),
        sku: undefined,
        status: 'DRAFT',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })),
    },
    workspaceId,
  )
  savePreviewProducts(workspaceId, [duplicated, ...products], storage)
  appendProductActivity(
    workspaceId,
    createProductActivity({
      workspaceId,
      productId: duplicated.id,
      title: `Product duplicated from ${product.name}.`,
    }),
    storage,
  )
  return { product: duplicated, errors: {} }
}
