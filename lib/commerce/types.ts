export type CommerceMoney = {
  amount: number
  currency: string
}

export type CommerceAddress = {
  name?: string
  company?: string
  line1: string
  line2?: string
  city: string
  region?: string
  postalCode: string
  country: string
  phone?: string
}

export type CommerceCustomerStatus = 'NEW' | 'ACTIVE' | 'AT_RISK' | 'INACTIVE'

export type CommerceCustomerType =
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'RETAIL'
  | 'WHOLESALE'
  | 'DISTRIBUTOR'
  | 'GOVERNMENT'
  | 'NONPROFIT'
  | 'EMPLOYEE'
  | 'INTERNAL'

export type CommerceCustomerTagStatus = 'active' | 'archived'

export type CommerceCustomerTag = {
  id: string
  workspaceId: string
  label: string
  normalizedLabel: string
  status: CommerceCustomerTagStatus
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type CommerceCustomerTypeDefinition = {
  id: string
  workspaceId: string
  name: string
  normalizedName: string
  isActive: boolean
  isArchived: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type CommerceProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export type CommerceOrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'

export type CommercePaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'

export type CommerceFulfillmentStatus =
  | 'UNFULFILLED'
  | 'PICKING'
  | 'PACKING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED'

export type CommerceFulfillmentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type CommerceShippingPayer = 'CUSTOMER' | 'BUSINESS'

export type CommerceShippingCostState = 'ESTIMATED' | 'ACTUAL'

export type CommerceDiscountType = 'NONE' | 'FIXED_AMOUNT' | 'PERCENTAGE'

export type CommerceOrderSource =
  | 'MANUAL'
  | 'SHOPIFY'
  | 'WOOCOMMERCE'
  | 'SQUARE'
  | 'AMAZON'
  | 'API'
  | 'OTHER'

export type CustomerRelationshipKind =
  | 'SERVICE_CLIENT'
  | 'COMMERCE_CUSTOMER'
  | 'BOTH'

export type CommerceCustomer = {
  id: string
  workspaceId: string
  relationshipKind: CustomerRelationshipKind
  sharedIdentityId?: string
  displayName: string
  companyName?: string
  email?: string
  phone?: string
  lifecycleStatus: CommerceCustomerStatus
  customerTypeId?: string
  customerType?: CommerceCustomerType
  legacyCustomerTypeName?: string
  tags?: string[]
  billingAddress?: CommerceAddress
  shippingAddress?: CommerceAddress
  defaultShippingAddress?: 'BILLING' | 'SHIPPING'
  clientNotes?: string
  internalNotes?: string
  archivedAt?: string
  createdAt: string
  updatedAt: string
}

export type CommerceProductVariant = {
  id: string
  workspaceId: string
  productId: string
  name: string
  optionValues: Record<string, string>
  sku?: string
  barcode?: string
  status: CommerceProductStatus
  price?: CommerceMoney
  cost?: CommerceMoney
  inventoryQuantity?: number
  createdAt: string
  updatedAt: string
}

export type CommerceProduct = {
  id: string
  workspaceId: string
  name: string
  description?: string
  slug?: string
  sku?: string
  barcode?: string
  status: CommerceProductStatus
  category?: string
  vendor?: string
  price: CommerceMoney
  compareAtPrice?: CommerceMoney
  cost?: CommerceMoney
  taxable: boolean
  trackInventory: boolean
  inventoryQuantity?: number
  lowStockThreshold?: number
  hasVariants: boolean
  variants: CommerceProductVariant[]
  imageUrl?: string
  tags?: string[]
  productNotes?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export type CommerceOrderLine = {
  id: string
  orderId: string
  productId?: string
  variantId?: string
  name: string
  sku?: string
  quantity: number
  unitPrice: number
  unitCost?: number
  discountType?: CommerceDiscountType
  discountValue?: number
  resolvedDiscountAmount?: number
  discountTotal: number
  taxTotal: number
  subtotal: number
  lineTotal: number
}

export type CommerceOrder = {
  id: string
  workspaceId: string
  orderNumber: string
  customerId?: string
  customerSnapshot?: {
    displayName: string
    companyName?: string
    email?: string
    phone?: string
  }
  status: CommerceOrderStatus
  paymentStatus: CommercePaymentStatus
  fulfillmentStatus: CommerceFulfillmentStatus
  currency: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  shippingTotal: number
  shippingCharge: number
  shippingCost?: number
  shippingCostState?: CommerceShippingCostState
  shippingPayer: CommerceShippingPayer
  total: number
  lines: CommerceOrderLine[]
  billingAddress?: CommerceAddress
  shippingAddress?: CommerceAddress
  shippingSameAsBilling: boolean
  shippingMethod?: string
  shippingCarrier?: string
  trackingNumber?: string
  estimatedDelivery?: string
  source: CommerceOrderSource
  externalId?: string
  sourceStoreId?: string
  rawMetadata?: Record<string, unknown>
  orderNotes?: string
  customerNotesSnapshot?: string
  archivedAt?: string
  cancelledAt?: string
  createdAt: string
  updatedAt: string
}

export type CommerceShippingDefaults = {
  payer: CommerceShippingPayer
  method?: string
  carrier?: string
  shippingCharge?: number
  shippingCost?: number
  shippingCostState?: CommerceShippingCostState
}

export type CommercePreviewSettings = {
  workspaceId: string
  shippingDefaults: CommerceShippingDefaults
  updatedAt: string
}

export type CommerceImportedOrderPayload = {
  externalId: string
  source: Exclude<CommerceOrderSource, 'MANUAL'>
  sourceStoreId?: string
  customer?: Partial<CommerceCustomer>
  billingAddress?: Partial<CommerceAddress>
  shippingAddress?: Partial<CommerceAddress>
  lineItems: Array<
    Partial<CommerceOrderLine> & {
      externalId?: string
      rawMetadata?: Record<string, unknown>
    }
  >
  paymentStatus?: CommercePaymentStatus
  fulfillmentStatus?: CommerceFulfillmentStatus
  discounts?: number
  tax?: number
  shippingCharge?: number
  shippingCost?: number
  shippingCostState?: CommerceShippingCostState
  shippingMethod?: string
  carrier?: string
  trackingNumber?: string
  currency?: string
  createdAt?: string
  updatedAt?: string
  rawMetadata?: Record<string, unknown>
}

export type CommerceFulfillment = {
  id: string
  workspaceId: string
  fulfillmentNumber: string
  orderId: string
  customerId?: string
  status: CommerceFulfillmentStatus
  priority: CommerceFulfillmentPriority
  assignedTo?: string
  shippingMethod?: string
  trackingNumber?: string
  carrier?: string
  estimatedDelivery?: string
  shippedAt?: string
  deliveredAt?: string
  internalNotes?: string
  customerNotesSnapshot?: string
  createdAt: string
  updatedAt: string
}

export type CommerceActivity = {
  id: string
  workspaceId: string
  recordId: string
  recordType: 'customer' | 'product' | 'order' | 'fulfillment'
  title: string
  description?: string
  createdAt: string
}
