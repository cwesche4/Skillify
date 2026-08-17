import type { WorkspaceModuleKey } from '@/lib/workspaces/businessModelRegistry'
import type {
  CommerceCustomerStatus,
  CommerceCustomerType,
  CommerceFulfillmentStatus,
  CommerceOrderStatus,
  CommercePaymentStatus,
  CommerceProductStatus,
} from '@/lib/commerce/types'

export type CommerceModuleStatus =
  | 'ACTIVE'
  | 'FOUNDATION'
  | 'HIDDEN'
  | 'COMING_SOON'

export type CommerceTerminology = {
  customerSingular: string
  customerPlural: string
  productSingular: string
  productPlural: string
  orderSingular: string
  orderPlural: string
  fulfillmentSingular: string
  fulfillmentPlural: string
  inventory: string
  subscriptionSingular: string
  subscriptionPlural: string
  wholesaleAccount: string
  returnSingular: string
  returnPlural: string
}

export const DEFAULT_COMMERCE_TERMINOLOGY: CommerceTerminology = {
  customerSingular: 'Customer',
  customerPlural: 'Customers',
  productSingular: 'Product',
  productPlural: 'Products',
  orderSingular: 'Order',
  orderPlural: 'Orders',
  fulfillmentSingular: 'Fulfillment',
  fulfillmentPlural: 'Fulfillment',
  inventory: 'Inventory',
  subscriptionSingular: 'Subscription',
  subscriptionPlural: 'Subscriptions',
  wholesaleAccount: 'Wholesale Account',
  returnSingular: 'Return',
  returnPlural: 'Returns',
}

export type CommerceModuleDefinition = {
  id:
    | 'customers'
    | 'products'
    | 'orders'
    | 'fulfillment'
    | 'inventory'
    | 'subscriptions'
    | 'wholesale'
    | 'returns'
    | 'discounts'
    | 'suppliers'
  label: string
  description: string
  capability: WorkspaceModuleKey
  route: string
  icon: 'customers' | 'products' | 'orders' | 'fulfillment' | 'inventory'
  status: CommerceModuleStatus
  visibleInNavigation: boolean
}

export const COMMERCE_MODULES: CommerceModuleDefinition[] = [
  {
    id: 'customers',
    label: 'Customers',
    description: 'People and businesses that buy from this workspace.',
    capability: 'customers',
    route: '/customers',
    icon: 'customers',
    status: 'FOUNDATION',
    visibleInNavigation: true,
  },
  {
    id: 'products',
    label: 'Products',
    description: 'Catalog items customers can purchase.',
    capability: 'products',
    route: '/products',
    icon: 'products',
    status: 'FOUNDATION',
    visibleInNavigation: true,
  },
  {
    id: 'orders',
    label: 'Orders',
    description: 'Purchases from confirmation through completion.',
    capability: 'orders',
    route: '/orders',
    icon: 'orders',
    status: 'FOUNDATION',
    visibleInNavigation: true,
  },
  {
    id: 'fulfillment',
    label: 'Fulfillment',
    description: 'Pick, pack, ship, deliver, and exception work.',
    capability: 'fulfillment',
    route: '/fulfillment',
    icon: 'fulfillment',
    status: 'FOUNDATION',
    visibleInNavigation: true,
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Stock levels, purchasing signals, and replenishment.',
    capability: 'inventory',
    route: '/inventory',
    icon: 'inventory',
    status: 'HIDDEN',
    visibleInNavigation: false,
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    description: 'Recurring purchase relationships and subscription status.',
    capability: 'subscriptions',
    route: '/subscriptions',
    icon: 'orders',
    status: 'HIDDEN',
    visibleInNavigation: false,
  },
  {
    id: 'wholesale',
    label: 'Wholesale',
    description: 'Wholesale accounts, terms, and purchase flows.',
    capability: 'wholesale',
    route: '/wholesale',
    icon: 'customers',
    status: 'HIDDEN',
    visibleInNavigation: false,
  },
  {
    id: 'returns',
    label: 'Returns',
    description: 'Return requests, refunds, and resolution status.',
    capability: 'returns',
    route: '/returns',
    icon: 'fulfillment',
    status: 'HIDDEN',
    visibleInNavigation: false,
  },
  {
    id: 'discounts',
    label: 'Discounts',
    description: 'Promotions, codes, and pricing adjustments.',
    capability: 'discounts',
    route: '/discounts',
    icon: 'orders',
    status: 'HIDDEN',
    visibleInNavigation: false,
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    description: 'Supplier and purchasing relationships.',
    capability: 'suppliers',
    route: '/suppliers',
    icon: 'inventory',
    status: 'HIDDEN',
    visibleInNavigation: false,
  },
]

export const COMMERCE_CUSTOMER_STATUS_ORDER: CommerceCustomerStatus[] = [
  'NEW',
  'ACTIVE',
  'AT_RISK',
  'INACTIVE',
]

export const COMMERCE_CUSTOMER_STATUS_OPTIONS =
  COMMERCE_CUSTOMER_STATUS_ORDER.map((status) => ({
    value: status,
    label:
      status === 'AT_RISK'
        ? 'At Risk'
        : status === 'NEW'
          ? 'New'
          : status === 'ACTIVE'
            ? 'Active'
            : 'Inactive',
    description:
      status === 'NEW'
        ? 'Customer was recently created or has not yet established repeat purchasing activity.'
        : status === 'ACTIVE'
          ? 'Customer currently has an active purchasing relationship.'
          : status === 'AT_RISK'
            ? 'Customer may need attention because of inactivity, issues, or declining purchasing behavior.'
            : 'Customer is no longer considered active.',
  }))

export const COMMERCE_CUSTOMER_TYPE_ORDER: CommerceCustomerType[] = [
  'RESIDENTIAL',
  'COMMERCIAL',
  'RETAIL',
  'WHOLESALE',
  'DISTRIBUTOR',
  'GOVERNMENT',
  'NONPROFIT',
  'EMPLOYEE',
  'INTERNAL',
]

export const COMMERCE_CUSTOMER_TYPE_OPTIONS = COMMERCE_CUSTOMER_TYPE_ORDER.map(
  (type) => ({
    value: type,
    label:
      type === 'RESIDENTIAL'
        ? 'Residential'
        : type === 'COMMERCIAL'
          ? 'Commercial'
          : type === 'RETAIL'
            ? 'Retail'
            : type === 'WHOLESALE'
              ? 'Wholesale'
              : type === 'DISTRIBUTOR'
                ? 'Distributor'
                : type === 'GOVERNMENT'
                  ? 'Government'
                  : type === 'NONPROFIT'
                    ? 'Nonprofit'
                    : type === 'EMPLOYEE'
                      ? 'Employee'
                      : 'Internal',
  }),
)

export const COMMERCE_PRODUCT_STATUS_ORDER: CommerceProductStatus[] = [
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
]

export type CommerceInventoryState =
  | 'ALL'
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'NOT_TRACKED'

export const COMMERCE_PRODUCT_STATUS_OPTIONS =
  COMMERCE_PRODUCT_STATUS_ORDER.map((status) => ({
    value: status,
    label:
      status === 'DRAFT'
        ? 'Draft'
        : status === 'ACTIVE'
          ? 'Active'
          : 'Archived',
  }))

export const COMMERCE_INVENTORY_STATE_OPTIONS: Array<{
  value: CommerceInventoryState
  label: string
}> = [
  { value: 'ALL', label: 'All inventory' },
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'LOW_STOCK', label: 'Low Stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { value: 'NOT_TRACKED', label: 'Not Tracked' },
]

export const COMMERCE_PRODUCT_TABLE_COLUMNS = [
  { id: 'product', label: 'Product' },
  { id: 'status', label: 'Status' },
  { id: 'sku', label: 'SKU' },
  { id: 'category', label: 'Category' },
  { id: 'price', label: 'Price' },
  { id: 'cost', label: 'Cost' },
  { id: 'margin', label: 'Margin' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'updated', label: 'Updated' },
] as const

export const COMMERCE_PRODUCT_FILTERS = [
  { id: 'status', label: 'Status' },
  { id: 'category', label: 'Category' },
  { id: 'inventory', label: 'Inventory' },
] as const

export const COMMERCE_PRODUCT_VARIANT_LIMITS = {
  maxOptionGroups: 3,
  maxVariants: 100,
} as const

export const COMMERCE_PRODUCT_EVENT_LABELS = {
  'product.created': 'Product created',
  'product.updated': 'Product updated',
  'product.activated': 'Product activated',
  'product.drafted': 'Product moved to Draft',
  'product.archived': 'Product archived',
  'product.restored': 'Product restored',
  'product.price_changed': 'Price updated',
  'product.cost_changed': 'Cost updated',
  'product.inventory_changed': 'Inventory updated',
  'product.variant_created': 'Variant added',
  'product.variant_updated': 'Variant updated',
  'product.variant_removed': 'Variant removed',
  'product.notes_updated': 'Product Notes updated',
  'product.duplicated': 'Product duplicated',
} as const

export const COMMERCE_ORDER_STATUS_ORDER: CommerceOrderStatus[] = [
  'DRAFT',
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
]

export const COMMERCE_PAYMENT_STATUS_ORDER: CommercePaymentStatus[] = [
  'UNPAID',
  'PENDING',
  'PAID',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]

export const COMMERCE_FULFILLMENT_STATUS_ORDER: CommerceFulfillmentStatus[] = [
  'UNFULFILLED',
  'PICKING',
  'PACKING',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
]

export const COMMERCE_STATUS_LABELS: Record<
  | CommerceCustomerStatus
  | CommerceProductStatus
  | CommerceOrderStatus
  | CommercePaymentStatus
  | CommerceFulfillmentStatus,
  string
> = {
  NEW: 'New',
  ACTIVE: 'Active',
  AT_RISK: 'At Risk',
  INACTIVE: 'Inactive',
  DRAFT: 'Draft',
  ARCHIVED: 'Archived',
  UNPAID: 'Unpaid',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
  PENDING: 'Pending',
  PAID: 'Paid',
  PARTIALLY_REFUNDED: 'Partially Refunded',
  REFUNDED: 'Refunded',
  UNFULFILLED: 'Waiting',
  PICKING: 'Picking',
  PACKING: 'Packing',
  READY_TO_SHIP: 'Ready to Ship',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
}

const commerceOrderStatusDescriptions: Record<CommerceOrderStatus, string> = {
  DRAFT: 'Order is still being prepared and is not ready for processing.',
  PENDING: 'Order is waiting for confirmation or next review.',
  CONFIRMED:
    'Order has been accepted and can move through payment and fulfillment.',
  PROCESSING:
    'Order work is underway across payment, fulfillment, or operations.',
  COMPLETED: 'Order processing and fulfillment are finished.',
  CANCELLED: 'Order will not continue.',
}

const commercePaymentStatusDescriptions: Record<CommercePaymentStatus, string> =
  {
    UNPAID: 'No payment has been recorded.',
    PENDING: 'Payment is currently processing or awaiting confirmation.',
    PAID: 'Payment has been successfully received.',
    REFUNDED: 'The full payment has been returned.',
    PARTIALLY_REFUNDED: 'Some of the payment has been returned.',
  }

const commerceFulfillmentStatusDescriptions: Record<
  CommerceFulfillmentStatus,
  string
> = {
  UNFULFILLED: 'Fulfillment is waiting to begin.',
  PICKING: 'Items are being selected.',
  PACKING: 'Items are being packed.',
  READY_TO_SHIP: 'The order is packed and ready to leave the business.',
  SHIPPED: 'The order has left the business or warehouse.',
  DELIVERED: 'Delivery has been completed.',
  RETURNED: 'The order has been returned or is moving through return handling.',
  CANCELLED: 'Fulfillment will not continue.',
}

export const COMMERCE_ORDER_STATUS_OPTIONS = COMMERCE_ORDER_STATUS_ORDER.map(
  (status) => ({
    value: status,
    label: getCommerceStatusLabel(status),
    description: commerceOrderStatusDescriptions[status],
    requiresConfirmation: status === 'CANCELLED',
  }),
)

export const COMMERCE_PAYMENT_STATUS_OPTIONS =
  COMMERCE_PAYMENT_STATUS_ORDER.map((status) => ({
    value: status,
    label: getCommerceStatusLabel(status),
    description: commercePaymentStatusDescriptions[status],
    requiresConfirmation: status === 'REFUNDED',
  }))

export const COMMERCE_FULFILLMENT_STATUS_OPTIONS =
  COMMERCE_FULFILLMENT_STATUS_ORDER.map((status) => ({
    value: status,
    label: getCommerceStatusLabel(status),
    description: commerceFulfillmentStatusDescriptions[status],
    requiresConfirmation: status === 'RETURNED' || status === 'CANCELLED',
  }))

export const COMMERCE_FULFILLMENT_PRIORITY_ORDER = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
] as const

export const COMMERCE_FULFILLMENT_PRIORITY_OPTIONS =
  COMMERCE_FULFILLMENT_PRIORITY_ORDER.map((priority) => ({
    value: priority,
    label:
      priority === 'LOW'
        ? 'Low'
        : priority === 'MEDIUM'
          ? 'Medium'
          : priority === 'HIGH'
            ? 'High'
            : 'Urgent',
    description:
      priority === 'LOW'
        ? 'Routine fulfillment with no urgency.'
        : priority === 'MEDIUM'
          ? 'Normal fulfillment priority.'
          : priority === 'HIGH'
            ? 'Prioritize this fulfillment ahead of standard work.'
            : 'Requires immediate operational attention.',
  }))

export const COMMERCE_ORDER_TABLE_COLUMNS = [
  { id: 'order', label: 'Order Number' },
  { id: 'customer', label: 'Customer' },
  { id: 'status', label: 'Status' },
  { id: 'payment', label: 'Payment Status' },
  { id: 'fulfillment', label: 'Fulfillment Status' },
  { id: 'items', label: 'Items' },
  { id: 'total', label: 'Revenue / Total' },
  { id: 'cost', label: 'Cost' },
  { id: 'profit', label: 'Profit' },
  { id: 'margin', label: 'Margin' },
  { id: 'created', label: 'Created' },
  { id: 'updated', label: 'Updated' },
] as const

export const COMMERCE_ANALYTICS_METRICS = [
  'Total revenue',
  'Orders',
  'Average order value',
  'Repeat purchase rate',
  'Customer lifetime value',
  'Top products',
  'Fulfillment time',
  'Return rate',
] as const

export const COMMERCE_AUTOMATION_EVENTS = [
  'customer.created',
  'customer.updated',
  'product.created',
  'product.updated',
  'product.activated',
  'product.drafted',
  'product.archived',
  'product.restored',
  'product.price_changed',
  'product.inventory_changed',
  'product.low_stock',
  'product.variant_created',
  'product.variant_updated',
  'product.variant_removed',
  'order.created',
  'order.confirmed',
  'order.paid',
  'order.cancelled',
  'order.refunded',
  'fulfillment.created',
  'fulfillment.ready',
  'fulfillment.shipped',
  'fulfillment.delivered',
] as const

export function getCommerceModule(moduleId: CommerceModuleDefinition['id']) {
  return COMMERCE_MODULES.find((module) => module.id === moduleId) ?? null
}

export function getVisibleCommerceModules() {
  return COMMERCE_MODULES.filter((module) => module.visibleInNavigation)
}

export function getCommerceStatusLabel(status: string) {
  return (
    COMMERCE_STATUS_LABELS[status as keyof typeof COMMERCE_STATUS_LABELS] ??
    status
  )
}

export function getCommerceCustomerTypeLabel(type: string | undefined | null) {
  if (!type) return 'Not set'
  return (
    COMMERCE_CUSTOMER_TYPE_OPTIONS.find((option) => option.value === type)
      ?.label ?? type
  )
}

// Foundation lifecycle boundary:
// Order status answers “What is the overall state of the purchase?”
// Payment status answers “Has money been authorized, paid, failed, or refunded?”
// Fulfillment status answers “Has the merchandise been prepared and delivered?”
// Later workflows should keep these dimensions separate instead of collapsing
// payment and fulfillment progress into a single order state.
