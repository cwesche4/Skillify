'use client'

import {
  Archive,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  default as React,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClearFiltersButton } from '@/components/ui/ClearFiltersButton'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { Textarea } from '@/components/ui/Textarea'
import { FulfillmentDrawer } from '@/components/commerce/FulfillmentPage'
import {
  COMMERCE_FULFILLMENT_STATUS_OPTIONS,
  COMMERCE_ORDER_STATUS_OPTIONS,
  COMMERCE_ORDER_TABLE_COLUMNS,
  COMMERCE_PAYMENT_STATUS_OPTIONS,
  getCommerceStatusLabel,
} from '@/lib/commerce/commerceRegistry'
import {
  COMMERCE_DISCOUNT_TYPE_OPTIONS,
  calculateOrderTotals,
  formatCommerceAddressLines,
  getCustomerOrderMetrics,
  getMeaningfulOptionalIdentityValue,
  getEffectiveShippingAddress,
  getOrderCustomerLabel,
  getOrderLinePresentation,
  selectOrderCounts,
  selectOrders,
  type OrderSortKey,
  type OrderViewKey,
  type OrderProfitabilityFilter,
} from '@/lib/commerce/orderCatalog'
import {
  calculateOrderFinancials,
  calculateOrderFinancialsFromOrder,
  resolveLineDiscountAmount,
  summarizeOrderFinancials,
  type OrderFinancialResult,
} from '@/lib/commerce/calculateOrderFinancials'
import { commerceNumericInputRules } from '@/lib/commerce/numericInputRules'
import {
  maybeSeedEstimatedShippingCostFromCharge,
  useChargeAsEstimatedShippingCost,
} from '@/lib/commerce/orderShipping'
import { updateCommerceOrderQuickStatuses } from '@/lib/commerce/orderStatusTransitions'
import {
  formatCommerceMoney,
  formatProductPriceRange,
} from '@/lib/commerce/productPricing'
import {
  archivePreviewOrder,
  cancelPreviewOrder,
  commercePreviewCustomersChangedEvent,
  commercePreviewFulfillmentsChangedEvent,
  commercePreviewOrdersChangedEvent,
  commercePreviewProductsChangedEvent,
  commercePreviewSettingsChangedEvent,
  createPreviewOrder,
  duplicatePreviewOrder,
  getPreviewFulfillments,
  getPreviewCustomers,
  getPreviewOrderActivities,
  getPreviewOrders,
  getPreviewProducts,
  getPreviewCommerceSettings,
  savePreviewCommerceSettings,
  updatePreviewCustomer,
  updatePreviewOrder,
} from '@/lib/commerce/previewCommerceStorage'
import type {
  CommerceActivity,
  CommerceAddress,
  CommerceCustomer,
  CommerceDiscountType,
  CommerceFulfillment,
  CommerceFulfillmentStatus,
  CommerceOrder,
  CommerceOrderStatus,
  CommercePaymentStatus,
  CommercePreviewSettings,
  CommerceProduct,
  CommerceShippingCostState,
  CommerceShippingPayer,
} from '@/lib/commerce/types'
import { useClearFilters } from '@/hooks/useClearFilters'
import { cn } from '@/lib/utils'

type Props = {
  workspaceId: string
  canEdit?: boolean
}

type OrderQuickStatusDomain = 'order' | 'payment' | 'fulfillment'

type OrderQuickStatusOption =
  | (typeof COMMERCE_ORDER_STATUS_OPTIONS)[number]
  | (typeof COMMERCE_PAYMENT_STATUS_OPTIONS)[number]
  | (typeof COMMERCE_FULFILLMENT_STATUS_OPTIONS)[number]

type PendingStatusConfirmation = {
  domain: OrderQuickStatusDomain
  option: OrderQuickStatusOption
}

type OrderLineForm = {
  id: string
  productId: string
  variantId: string
  name: string
  sku: string
  quantity: string
  unitPrice: string
  unitCost: string
  discountType: CommerceDiscountType
  discountValue: string
  discountTotal: string
  taxTotal: string
}

type AddressFormState = {
  name: string
  company: string
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  country: string
  phone: string
}

type OrderFormState = {
  customerId: string
  createCustomer: boolean
  customerName: string
  customerCompany: string
  customerEmail: string
  customerPhone: string
  status: CommerceOrderStatus
  paymentStatus: CommercePaymentStatus
  fulfillmentStatus: CommerceFulfillmentStatus
  currency: string
  shippingCharge: string
  shippingCost: string
  shippingCostState: CommerceShippingCostState
  shippingCostTouched: boolean
  shippingPayer: CommerceShippingPayer
  billingAddress: AddressFormState
  shippingAddress: AddressFormState
  shippingSameAsBilling: boolean
  shippingMethod: string
  shippingCarrier: string
  trackingNumber: string
  estimatedDelivery: string
  orderNotes: string
  customerNotes: string
  lines: OrderLineForm[]
}

const ORDER_OVERLAY_TOP_OFFSET = 'var(--dashboard-top-bar-height, 3.5rem)'
const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const viewTabs: Array<{ id: OrderViewKey; label: string }> = [
  { id: 'all', label: 'All Orders' },
  { id: 'draft', label: 'Draft' },
  { id: 'open', label: 'Open' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
]

function getOrderStatusForView(
  view: OrderViewKey,
): 'ALL' | CommerceOrderStatus {
  if (view === 'draft') return 'DRAFT'
  if (view === 'completed') return 'COMPLETED'
  return 'ALL'
}

const summaryViews: Array<{
  view: OrderViewKey
  label: string
  ariaLabel: string
  countKey: keyof ReturnType<typeof selectOrderCounts>
  tone?: BadgeVariant
}> = [
  {
    view: 'all',
    label: 'Total Orders',
    ariaLabel: 'Show all orders',
    countKey: 'all',
  },
  {
    view: 'draft',
    label: 'Draft Orders',
    ariaLabel: 'Show draft orders',
    countKey: 'draft',
    tone: 'slate',
  },
  {
    view: 'open',
    label: 'Open Orders',
    ariaLabel: 'Show open orders',
    countKey: 'open',
    tone: 'blue',
  },
  {
    view: 'completed',
    label: 'Completed Orders',
    ariaLabel: 'Show completed orders',
    countKey: 'completed',
    tone: 'green',
  },
]

const sortOptions: Array<{ value: OrderSortKey; label: string }> = [
  { value: 'updated-desc', label: 'Recently Updated' },
  { value: 'created-desc', label: 'Recent' },
  { value: 'created-asc', label: 'Oldest' },
  { value: 'total-desc', label: 'Highest Revenue' },
  { value: 'total-asc', label: 'Lowest Revenue' },
  { value: 'profit-desc', label: 'Highest Profit' },
  { value: 'margin-asc', label: 'Lowest Margin' },
]

const shippingPayerOptions: Array<{
  value: CommerceShippingPayer
  label: string
}> = [
  { value: 'CUSTOMER', label: 'Customer pays shipping' },
  { value: 'BUSINESS', label: 'Business pays shipping' },
]

const profitabilityFilterOptions: Array<{
  value: OrderProfitabilityFilter
  label: string
}> = [
  { value: 'ALL', label: 'All profitability' },
  { value: 'PROFITABLE', label: 'Profitable' },
  { value: 'LOSS', label: 'Loss' },
  { value: 'INCOMPLETE', label: 'Profit incomplete' },
  { value: 'MISSING_COST', label: 'Missing product cost' },
]

const orderStatusVariant: Record<CommerceOrderStatus, BadgeVariant> = {
  DRAFT: 'slate',
  PENDING: 'blue',
  CONFIRMED: 'purple',
  PROCESSING: 'orange',
  COMPLETED: 'green',
  CANCELLED: 'red',
}

const paymentStatusVariant: Record<CommercePaymentStatus, BadgeVariant> = {
  UNPAID: 'slate',
  PENDING: 'orange',
  PAID: 'green',
  REFUNDED: 'gray',
  PARTIALLY_REFUNDED: 'yellow',
}

const fulfillmentStatusVariant: Record<
  CommerceFulfillmentStatus,
  BadgeVariant
> = {
  UNFULFILLED: 'slate',
  PICKING: 'blue',
  PACKING: 'purple',
  READY_TO_SHIP: 'orange',
  SHIPPED: 'green',
  DELIVERED: 'green',
  RETURNED: 'red',
  CANCELLED: 'red',
}

function createLine(): OrderLineForm {
  return {
    id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productId: '',
    variantId: '',
    name: '',
    sku: '',
    quantity: '1',
    unitPrice: '0',
    unitCost: '',
    discountType: 'NONE',
    discountValue: '',
    discountTotal: '0',
    taxTotal: '0',
  }
}

function emptyAddress(): AddressFormState {
  return {
    name: '',
    company: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
    phone: '',
  }
}

function addressFormFromAddress(
  address: Partial<CommerceAddress> | null | undefined,
): AddressFormState {
  return {
    name: address?.name ?? '',
    company: address?.company ?? '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    city: address?.city ?? '',
    region: address?.region ?? '',
    postalCode: address?.postalCode ?? '',
    country: address?.country ?? '',
    phone: address?.phone ?? '',
  }
}

function addressInputFromForm(
  address: AddressFormState,
): Partial<CommerceAddress> {
  return {
    name: address.name,
    company: address.company,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
  }
}

function isAddressFormEmpty(address: AddressFormState) {
  return Object.values(address).every((value) => !value.trim())
}

function formatOptionalNumber(value: number | undefined) {
  return value == null ? '' : String(value)
}

function getShippingCostStateHelper(state: CommerceShippingCostState) {
  return state === 'ACTUAL'
    ? 'Final business shipping expense.'
    : 'Estimated business shipping expense.'
}

function emptyForm(settings?: CommercePreviewSettings | null): OrderFormState {
  const billingAddress = emptyAddress()
  const shippingDefaults = settings?.shippingDefaults
  return {
    customerId: '',
    createCustomer: false,
    customerName: '',
    customerCompany: '',
    customerEmail: '',
    customerPhone: '',
    status: 'DRAFT',
    paymentStatus: 'UNPAID',
    fulfillmentStatus: 'UNFULFILLED',
    currency: 'USD',
    shippingCharge:
      shippingDefaults?.payer === 'BUSINESS'
        ? '0'
        : formatOptionalNumber(shippingDefaults?.shippingCharge),
    shippingCost: formatOptionalNumber(shippingDefaults?.shippingCost),
    shippingCostState: 'ESTIMATED',
    shippingCostTouched: Boolean(shippingDefaults?.shippingCost != null),
    shippingPayer: shippingDefaults?.payer ?? 'CUSTOMER',
    billingAddress,
    shippingAddress: emptyAddress(),
    shippingSameAsBilling: true,
    shippingMethod: shippingDefaults?.method ?? '',
    shippingCarrier: shippingDefaults?.carrier ?? '',
    trackingNumber: '',
    estimatedDelivery: '',
    orderNotes: '',
    customerNotes: '',
    lines: [createLine()],
  }
}

function formFromOrder(
  order: CommerceOrder,
  customer?: CommerceCustomer | null,
): OrderFormState {
  return {
    customerId: order.customerId ?? '',
    createCustomer: false,
    customerName:
      customer?.displayName ?? order.customerSnapshot?.displayName ?? '',
    customerCompany:
      customer?.companyName ?? order.customerSnapshot?.companyName ?? '',
    customerEmail: customer?.email ?? order.customerSnapshot?.email ?? '',
    customerPhone: customer?.phone ?? order.customerSnapshot?.phone ?? '',
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    currency: order.currency,
    billingAddress: addressFormFromAddress(order.billingAddress),
    shippingAddress: addressFormFromAddress(order.shippingAddress),
    shippingSameAsBilling: order.shippingSameAsBilling,
    shippingCharge: String(order.shippingCharge ?? order.shippingTotal ?? 0),
    shippingCost: formatOptionalNumber(order.shippingCost),
    shippingCostState: order.shippingCostState ?? 'ESTIMATED',
    shippingCostTouched: Boolean(order.shippingCost != null),
    shippingPayer: order.shippingPayer ?? 'CUSTOMER',
    shippingMethod: order.shippingMethod ?? '',
    shippingCarrier: order.shippingCarrier ?? '',
    trackingNumber: order.trackingNumber ?? '',
    estimatedDelivery: order.estimatedDelivery ?? '',
    orderNotes: order.orderNotes ?? '',
    customerNotes: customer?.clientNotes ?? order.customerNotesSnapshot ?? '',
    lines: order.lines.length
      ? order.lines.map((line) => ({
          id: line.id,
          productId: line.productId ?? '',
          variantId: line.variantId ?? '',
          name: line.name,
          sku: line.sku ?? '',
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
          unitCost: formatOptionalNumber(line.unitCost),
          discountType:
            line.discountType ??
            (Number(line.discountTotal ?? 0) > 0 ? 'FIXED_AMOUNT' : 'NONE'),
          discountValue:
            line.discountValue == null
              ? Number(line.discountTotal ?? 0) > 0
                ? String(line.discountTotal)
                : ''
              : String(line.discountValue),
          discountTotal: String(line.discountTotal),
          taxTotal: String(line.taxTotal),
        }))
      : [createLine()],
  }
}

function formToOrderInput(form: OrderFormState) {
  return {
    customerId: form.createCustomer ? undefined : form.customerId || undefined,
    inlineCustomer: form.createCustomer
      ? {
          displayName: form.customerName,
          companyName: form.customerCompany,
          email: form.customerEmail,
          phone: form.customerPhone,
          clientNotes: form.customerNotes,
        }
      : undefined,
    status: form.status,
    paymentStatus: form.paymentStatus,
    fulfillmentStatus: form.fulfillmentStatus,
    currency: form.currency || 'USD',
    shippingTotal: Number(form.shippingCharge || 0),
    shippingCharge: Number(form.shippingCharge || 0),
    shippingCost:
      form.shippingCost === '' ? undefined : Number(form.shippingCost || 0),
    shippingCostState:
      form.shippingCost === '' ? undefined : form.shippingCostState,
    shippingPayer: form.shippingPayer,
    billingAddress: addressInputFromForm(form.billingAddress),
    shippingAddress: form.shippingSameAsBilling
      ? addressInputFromForm(form.billingAddress)
      : addressInputFromForm(form.shippingAddress),
    shippingSameAsBilling: form.shippingSameAsBilling,
    shippingMethod: form.shippingMethod,
    shippingCarrier: form.shippingCarrier,
    trackingNumber: form.trackingNumber,
    estimatedDelivery: form.estimatedDelivery,
    orderNotes: form.orderNotes,
    customerNotesSnapshot: form.customerNotes,
    lines: form.lines.map((line) => ({
      id: line.id,
      productId: line.productId || undefined,
      variantId: line.variantId || undefined,
      name: line.name,
      sku: line.sku,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      unitCost: line.unitCost === '' ? undefined : Number(line.unitCost || 0),
      discountType: line.discountType,
      discountValue:
        line.discountType === 'NONE' ? 0 : Number(line.discountValue || 0),
      resolvedDiscountAmount: resolveLineDiscountAmount({
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        discountType: line.discountType,
        discountValue:
          line.discountType === 'NONE' ? 0 : Number(line.discountValue || 0),
      }),
      discountTotal: resolveLineDiscountAmount({
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        discountType: line.discountType,
        discountValue:
          line.discountType === 'NONE' ? 0 : Number(line.discountValue || 0),
      }),
      taxTotal: Number(line.taxTotal || 0),
    })),
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatCurrency(amount: number, currency = 'USD') {
  return formatCommerceMoney({ amount, currency })
}

function formatShippingPayer(value: CommerceShippingPayer) {
  return value === 'BUSINESS'
    ? 'Business-paid shipping'
    : 'Customer-paid shipping'
}

function formatMargin(value: number | null) {
  return value == null ? 'Missing costs' : `${value}%`
}

function serializeOrderForm(form: OrderFormState) {
  return JSON.stringify({
    ...form,
    lines: form.lines.map(({ id: _id, ...line }) => line),
  })
}

export function OrdersPage({ workspaceId, canEdit = true }: Props) {
  const [orders, setOrders] = useState<CommerceOrder[]>([])
  const [customers, setCustomers] = useState<CommerceCustomer[]>([])
  const [products, setProducts] = useState<CommerceProduct[]>([])
  const [fulfillments, setFulfillments] = useState<CommerceFulfillment[]>([])
  const [view, setView] = useState<OrderViewKey>('all')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | CommerceOrderStatus>('ALL')
  const [paymentStatus, setPaymentStatus] = useState<
    'ALL' | CommercePaymentStatus
  >('ALL')
  const [fulfillmentStatus, setFulfillmentStatus] = useState<
    'ALL' | CommerceFulfillmentStatus
  >('ALL')
  const [shippingPayer, setShippingPayer] = useState<
    'ALL' | CommerceShippingPayer
  >('ALL')
  const [profitability, setProfitability] =
    useState<OrderProfitabilityFilter>('ALL')
  const [sort, setSort] = useState<OrderSortKey>('updated-desc')
  const expectedStatusForView = getOrderStatusForView(view)
  const clearSecondaryFilters = () => {
    setQuery('')
    setStatus(expectedStatusForView)
    setPaymentStatus('ALL')
    setFulfillmentStatus('ALL')
    setShippingPayer('ALL')
    setProfitability('ALL')
  }
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      query,
      status: status === expectedStatusForView ? '' : status,
      paymentStatus: paymentStatus === 'ALL' ? '' : paymentStatus,
      fulfillmentStatus: fulfillmentStatus === 'ALL' ? '' : fulfillmentStatus,
      shippingPayer: shippingPayer === 'ALL' ? '' : shippingPayer,
      profitability: profitability === 'ALL' ? '' : profitability,
    },
    onClear: clearSecondaryFilters,
  })
  const applyView = (nextView: OrderViewKey) => {
    setView(nextView)
    setQuery('')
    setStatus(getOrderStatusForView(nextView))
    setPaymentStatus('ALL')
    setFulfillmentStatus('ALL')
    setShippingPayer('ALL')
    setProfitability('ALL')
  }
  const applyStatus = (nextStatus: 'ALL' | CommerceOrderStatus) => {
    setStatus(nextStatus)
  }
  const [commerceSettings, setCommerceSettings] =
    useState<CommercePreviewSettings | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedFulfillmentId, setSelectedFulfillmentId] = useState<
    string | null
  >(null)

  const reload = useCallback(() => {
    setOrders(getPreviewOrders(workspaceId))
    setCustomers(getPreviewCustomers(workspaceId))
    setProducts(getPreviewProducts(workspaceId))
    setFulfillments(getPreviewFulfillments(workspaceId))
    setCommerceSettings(getPreviewCommerceSettings(workspaceId))
  }, [workspaceId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail
      if (!detail?.workspaceId || detail.workspaceId === workspaceId) reload()
    }
    window.addEventListener(commercePreviewOrdersChangedEvent, onChanged)
    window.addEventListener(commercePreviewFulfillmentsChangedEvent, onChanged)
    window.addEventListener(commercePreviewCustomersChangedEvent, onChanged)
    window.addEventListener(commercePreviewProductsChangedEvent, onChanged)
    window.addEventListener(commercePreviewSettingsChangedEvent, onChanged)
    window.addEventListener('storage', onChanged)
    return () => {
      window.removeEventListener(commercePreviewOrdersChangedEvent, onChanged)
      window.removeEventListener(
        commercePreviewFulfillmentsChangedEvent,
        onChanged,
      )
      window.removeEventListener(
        commercePreviewCustomersChangedEvent,
        onChanged,
      )
      window.removeEventListener(commercePreviewProductsChangedEvent, onChanged)
      window.removeEventListener(commercePreviewSettingsChangedEvent, onChanged)
      window.removeEventListener('storage', onChanged)
    }
  }, [reload, workspaceId])

  const counts = useMemo(() => selectOrderCounts(orders), [orders])
  const financialSummary = useMemo(
    () => summarizeOrderFinancials(orders, products),
    [orders, products],
  )
  const rows = useMemo(
    () =>
      selectOrders(
        orders,
        customers,
        {
          view,
          query,
          status,
          paymentStatus,
          fulfillmentStatus,
          shippingPayer,
          profitability,
          sort,
        },
        products,
      ),
    [
      customers,
      fulfillmentStatus,
      orders,
      paymentStatus,
      products,
      profitability,
      query,
      shippingPayer,
      sort,
      status,
      view,
    ],
  )
  const selectedOrder = selectedOrderId
    ? (orders.find((order) => order.id === selectedOrderId) ?? null)
    : null
  const selectedFulfillment = selectedFulfillmentId
    ? (fulfillments.find(
        (fulfillment) => fulfillment.id === selectedFulfillmentId,
      ) ?? null)
    : null

  return (
    <main className="text-neutral-text-primary min-h-screen bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
              Product & Commerce
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-50">
              Orders
            </h1>
            <p className="text-neutral-text-secondary mt-1 max-w-2xl text-sm">
              Track purchases, customer context, payment status, fulfillment
              status, and preview-safe order activity.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!canEdit}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Order
          </Button>
        </div>

        {commerceSettings ? (
          <ShippingDefaultsCard
            workspaceId={workspaceId}
            settings={commerceSettings}
            onSaved={reload}
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-6">
          {summaryViews.map((item) => (
            <button
              key={item.view}
              type="button"
              aria-label={item.ariaLabel}
              aria-pressed={view === item.view}
              onClick={() => applyView(item.view)}
              className={cn(
                'rounded-2xl border border-slate-800 bg-slate-900/45 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                'hover:border-cyan-300/35 hover:bg-cyan-300/[0.05]',
                view === item.view && 'border-cyan-300/55 bg-cyan-300/[0.08]',
              )}
            >
              <p className="text-neutral-text-secondary text-xs font-medium">
                {item.label}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="text-2xl font-semibold text-neutral-50">
                  {counts[item.countKey]}
                </p>
                {item.tone ? <Badge variant={item.tone}>Filter</Badge> : null}
              </div>
            </button>
          ))}
          <Card className="rounded-2xl border-slate-800 bg-slate-900/45 p-4">
            <p className="text-neutral-text-secondary text-xs font-medium">
              Revenue
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">
              {formatCurrency(financialSummary.revenue)}
            </p>
            <p className="text-neutral-text-secondary mt-1 text-xs">
              Product sales plus shipping collected, excluding tax
            </p>
          </Card>
          <Card className="rounded-2xl border-slate-800 bg-slate-900/45 p-4">
            <p className="text-neutral-text-secondary text-xs font-medium">
              Gross Profit
            </p>
            <p className="mt-2 text-2xl font-semibold text-cyan-200">
              {financialSummary.orderGrossProfit == null
                ? 'Incomplete'
                : formatCurrency(financialSummary.orderGrossProfit)}
            </p>
            <p className="text-neutral-text-secondary mt-1 text-xs">
              {financialSummary.incompleteOrderCount > 0
                ? `${financialSummary.incompleteOrderCount} missing cost data`
                : `${financialSummary.orderMarginPercent ?? 0}% order margin`}
            </p>
          </Card>
        </div>

        <Card className="rounded-2xl border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {viewTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => applyView(tab.id)}
                  className={cn(
                    'rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.06] hover:text-white',
                    view === tab.id &&
                      'border-cyan-300/60 bg-cyan-300/[0.1] text-cyan-100',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <ClearFiltersButton
              count={activeFilterCount}
              onClear={clearFilters}
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]">
            <label className="relative">
              <Search className="text-neutral-text-secondary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search order, customer, item, SKU..."
                className="pl-9"
              />
            </label>
            <Select
              value={status}
              onChange={(event) =>
                applyStatus(event.target.value as 'ALL' | CommerceOrderStatus)
              }
            >
              <option value="ALL">All order statuses</option>
              {COMMERCE_ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={paymentStatus}
              onChange={(event) =>
                setPaymentStatus(
                  event.target.value as 'ALL' | CommercePaymentStatus,
                )
              }
            >
              <option value="ALL">All payment statuses</option>
              {COMMERCE_PAYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={fulfillmentStatus}
              onChange={(event) =>
                setFulfillmentStatus(
                  event.target.value as 'ALL' | CommerceFulfillmentStatus,
                )
              }
            >
              <option value="ALL">All fulfillment statuses</option>
              {COMMERCE_FULFILLMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={shippingPayer}
              onChange={(event) =>
                setShippingPayer(
                  event.target.value as 'ALL' | CommerceShippingPayer,
                )
              }
            >
              <option value="ALL">All shipping payers</option>
              {shippingPayerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={profitability}
              onChange={(event) =>
                setProfitability(event.target.value as OrderProfitabilityFilter)
              }
            >
              {profitabilityFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as OrderSortKey)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  {COMMERCE_ORDER_TABLE_COLUMNS.map((column) => (
                    <TH key={column.id}>{column.label}</TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {rows.length ? (
                  rows.map((order) => {
                    const financials = calculateOrderFinancialsFromOrder(
                      order,
                      products,
                    )
                    return (
                      <TR
                        key={order.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <TD>
                          <div className="font-medium text-neutral-100">
                            {order.orderNumber}
                          </div>
                          {order.archivedAt ? (
                            <p className="text-neutral-text-secondary text-xs">
                              Archived
                            </p>
                          ) : null}
                        </TD>
                        <TD>{getOrderCustomerLabel(order, customers)}</TD>
                        <TD>
                          <Badge variant={orderStatusVariant[order.status]}>
                            {getCommerceStatusLabel(order.status)}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge
                            variant={paymentStatusVariant[order.paymentStatus]}
                          >
                            {getCommerceStatusLabel(order.paymentStatus)}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge
                            variant={
                              fulfillmentStatusVariant[order.fulfillmentStatus]
                            }
                          >
                            {getCommerceStatusLabel(order.fulfillmentStatus)}
                          </Badge>
                        </TD>
                        <TD>{order.lines.length}</TD>
                        <TD>
                          <div className="font-medium text-neutral-100">
                            {formatCurrency(
                              financials.totalOrderRevenue,
                              order.currency,
                            )}
                          </div>
                          {financials.taxes > 0 ? (
                            <p className="text-neutral-text-secondary text-xs">
                              Customer total{' '}
                              {formatCurrency(
                                financials.customerTotal,
                                order.currency,
                              )}
                            </p>
                          ) : null}
                        </TD>
                        <TD>
                          {financials.totalCost == null
                            ? 'Incomplete'
                            : formatCurrency(
                                financials.totalCost,
                                order.currency,
                              )}
                        </TD>
                        <TD>
                          {financials.orderGrossProfit == null
                            ? 'Profit unavailable'
                            : formatCurrency(
                                financials.orderGrossProfit,
                                order.currency,
                              )}
                        </TD>
                        <TD>
                          {financials.orderMarginPercent == null
                            ? 'Missing costs'
                            : `${financials.orderMarginPercent}%`}
                        </TD>
                        <TD>{formatDate(order.createdAt)}</TD>
                        <TD>{formatDate(order.updatedAt)}</TD>
                      </TR>
                    )
                  })
                ) : (
                  <TR>
                    <TD colSpan={COMMERCE_ORDER_TABLE_COLUMNS.length}>
                      <div className="flex flex-col items-center justify-center py-14 text-center">
                        <ReceiptText className="h-10 w-10 text-cyan-300/60" />
                        <h2 className="mt-3 text-base font-semibold text-neutral-100">
                          No orders match this view.
                        </h2>
                        <p className="text-neutral-text-secondary mt-1 max-w-md text-sm">
                          Add a preview order or adjust filters to review
                          purchases.
                        </p>
                        <Button
                          type="button"
                          className="mt-4"
                          onClick={() => setAddOpen(true)}
                          disabled={!canEdit}
                        >
                          Add Order
                        </Button>
                      </div>
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </div>
        </Card>
      </div>

      {addOpen ? (
        <OrderModal
          workspaceId={workspaceId}
          products={products}
          customers={customers}
          commerceSettings={commerceSettings}
          onClose={() => setAddOpen(false)}
          onSaved={(orderId) => {
            reload()
            setAddOpen(false)
            setSelectedOrderId(orderId)
          }}
        />
      ) : null}
      {selectedOrder ? (
        <OrderDrawer
          workspaceId={workspaceId}
          order={selectedOrder}
          orders={orders}
          customers={customers}
          products={products}
          commerceSettings={commerceSettings}
          canEdit={canEdit}
          onClose={() => setSelectedOrderId(null)}
          onReload={reload}
          onSelectOrder={setSelectedOrderId}
          fulfillments={fulfillments}
          onSelectFulfillment={(fulfillmentId) => {
            setSelectedOrderId(null)
            setSelectedFulfillmentId(fulfillmentId)
          }}
        />
      ) : null}
      {selectedFulfillment ? (
        <FulfillmentDrawer
          workspaceId={workspaceId}
          fulfillment={selectedFulfillment}
          orders={orders}
          customers={customers}
          products={products}
          canEdit={canEdit}
          onClose={() => setSelectedFulfillmentId(null)}
          onReload={reload}
          onSelectFulfillment={setSelectedFulfillmentId}
          onSelectOrder={(orderId) => {
            setSelectedFulfillmentId(null)
            setSelectedOrderId(orderId)
          }}
        />
      ) : null}
    </main>
  )
}

function ShippingDefaultsCard({
  workspaceId,
  settings,
  onSaved,
}: {
  workspaceId: string
  settings: CommercePreviewSettings
  onSaved: () => void
}) {
  const [payer, setPayer] = useState<CommerceShippingPayer>(
    settings.shippingDefaults.payer,
  )
  const [method, setMethod] = useState(settings.shippingDefaults.method ?? '')
  const [carrier, setCarrier] = useState(
    settings.shippingDefaults.carrier ?? '',
  )
  const [shippingCharge, setShippingCharge] = useState(
    formatOptionalNumber(settings.shippingDefaults.shippingCharge),
  )
  const [shippingCost, setShippingCost] = useState(
    formatOptionalNumber(settings.shippingDefaults.shippingCost),
  )

  useEffect(() => {
    setPayer(settings.shippingDefaults.payer)
    setMethod(settings.shippingDefaults.method ?? '')
    setCarrier(settings.shippingDefaults.carrier ?? '')
    setShippingCharge(
      formatOptionalNumber(settings.shippingDefaults.shippingCharge),
    )
    setShippingCost(
      formatOptionalNumber(settings.shippingDefaults.shippingCost),
    )
  }, [settings])

  const dirty =
    payer !== settings.shippingDefaults.payer ||
    method !== (settings.shippingDefaults.method ?? '') ||
    carrier !== (settings.shippingDefaults.carrier ?? '') ||
    shippingCharge !==
      formatOptionalNumber(settings.shippingDefaults.shippingCharge) ||
    shippingCost !==
      formatOptionalNumber(settings.shippingDefaults.shippingCost)

  function discard() {
    setPayer(settings.shippingDefaults.payer)
    setMethod(settings.shippingDefaults.method ?? '')
    setCarrier(settings.shippingDefaults.carrier ?? '')
    setShippingCharge(
      formatOptionalNumber(settings.shippingDefaults.shippingCharge),
    )
    setShippingCost(
      formatOptionalNumber(settings.shippingDefaults.shippingCost),
    )
  }

  function save() {
    savePreviewCommerceSettings({
      workspaceId,
      settings: {
        ...settings,
        shippingDefaults: {
          payer,
          method: method.trim() || undefined,
          carrier: carrier.trim() || undefined,
          shippingCharge:
            shippingCharge.trim() === ''
              ? undefined
              : Number(shippingCharge || 0),
          shippingCost:
            shippingCost.trim() === '' ? undefined : Number(shippingCost || 0),
        },
      },
    })
    onSaved()
  }

  return (
    <Card className="rounded-2xl border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">
            Workspace shipping defaults
          </h2>
          <p className="text-neutral-text-secondary mt-1 max-w-2xl text-xs">
            New manual orders inherit these defaults. Customer shipping charges
            and business shipping costs remain independently editable.
          </p>
        </div>
        {dirty ? (
          <Badge variant="yellow">Unsaved changes</Badge>
        ) : (
          <Badge variant="slate">Preview settings</Badge>
        )}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_auto]">
        <Field label="Default payer">
          <Select
            value={payer}
            onChange={(event) =>
              setPayer(event.target.value as CommerceShippingPayer)
            }
          >
            {shippingPayerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Default method">
          <Input
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            placeholder="Ground, pickup, courier..."
          />
        </Field>
        <Field label="Default carrier">
          <Input
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
            placeholder="UPS, USPS, local courier..."
          />
        </Field>
        <Field label="Default charge">
          <Input
            type="number"
            {...commerceNumericInputRules.money}
            value={shippingCharge}
            onChange={(event) => setShippingCharge(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Default estimated shipping cost">
          <Input
            type="number"
            {...commerceNumericInputRules.money}
            value={shippingCost}
            onChange={(event) => setShippingCost(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={discard}
            disabled={!dirty}
          >
            Discard
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  )
}

function OrderModal({
  workspaceId,
  products,
  customers,
  commerceSettings,
  onClose,
  onSaved,
}: {
  workspaceId: string
  products: CommerceProduct[]
  customers: CommerceCustomer[]
  commerceSettings: CommercePreviewSettings | null
  onClose: () => void
  onSaved: (orderId: string) => void
}) {
  const [portalReady, setPortalReady] = useState(false)
  const [form, setForm] = useState<OrderFormState>(() =>
    emptyForm(commerceSettings),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const modalRef = useRef<HTMLFormElement>(null)
  const initialFormRef = useRef(serializeOrderForm(form))
  const isDirty = serializeOrderForm(form) !== initialFormRef.current

  const safeClose = useCallback(() => {
    if (isDirty && !window.confirm('Discard this unsaved order?')) return
    onClose()
  }, [isDirty, onClose])

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    modalRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') safeClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [safeClose])

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = createPreviewOrder({
      workspaceId,
      input: formToOrderInput(form),
    })
    if (!result.order) {
      setErrors(result.errors)
      return
    }
    onSaved(result.order.id)
  }

  const modal = (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center bg-slate-950/70 p-4"
      style={{ top: ORDER_OVERLAY_TOP_OFFSET }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) safeClose()
      }}
    >
      <form
        ref={modalRef}
        onSubmit={submit}
        className="flex max-h-[calc(100dvh-var(--dashboard-top-bar-height,3.5rem)-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950 p-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-50">Add Order</h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              Create a preview order from catalog products and commerce
              customers.
            </p>
          </div>
          <button
            type="button"
            onClick={safeClose}
            className="text-neutral-text-secondary rounded-xl p-2 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close Add Order"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <OrderForm
            form={form}
            setForm={setForm}
            errors={errors}
            customers={customers}
            products={products}
            commerceSettings={commerceSettings}
            isNewOrder
          />
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-800 bg-slate-950 p-4">
          <Button type="button" variant="outline" onClick={safeClose}>
            Cancel
          </Button>
          <Button type="submit">Save Order</Button>
        </div>
      </form>
    </div>
  )

  return portalReady ? createPortal(modal, document.body) : null
}

function OrderDrawer({
  workspaceId,
  order,
  orders,
  customers,
  products,
  fulfillments,
  commerceSettings,
  canEdit,
  onClose,
  onReload,
  onSelectOrder,
  onSelectFulfillment,
}: {
  workspaceId: string
  order: CommerceOrder
  orders: CommerceOrder[]
  customers: CommerceCustomer[]
  products: CommerceProduct[]
  fulfillments: CommerceFulfillment[]
  commerceSettings: CommercePreviewSettings | null
  canEdit: boolean
  onClose: () => void
  onReload: () => void
  onSelectOrder: (id: string) => void
  onSelectFulfillment: (id: string) => void
}) {
  const [portalReady, setPortalReady] = useState(false)
  const [editing, setEditing] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const customer = order.customerId
    ? (customers.find((record) => record.id === order.customerId) ?? null)
    : null
  const [form, setForm] = useState<OrderFormState>(() =>
    formFromOrder(order, customer),
  )
  const [statusDraft, setStatusDraft] = useState(() => ({
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
  }))
  const activities = getPreviewOrderActivities(workspaceId, order.id)
  const baselineForm = useMemo(
    () => serializeOrderForm(formFromOrder(order, customer)),
    [customer, order],
  )
  const editingDirty = editing && serializeOrderForm(form) !== baselineForm
  const statusDirty =
    statusDraft.status !== order.status ||
    statusDraft.paymentStatus !== order.paymentStatus ||
    statusDraft.fulfillmentStatus !== order.fulfillmentStatus

  const safeClose = useCallback(() => {
    if (
      (editingDirty || statusDirty) &&
      !window.confirm('Discard unsaved order changes?')
    ) {
      return
    }
    onClose()
  }, [editingDirty, onClose, statusDirty])

  const cancelEditing = useCallback(() => {
    if (editingDirty && !window.confirm('Discard unsaved order changes?'))
      return
    setEditing(false)
    setForm(formFromOrder(order, customer))
  }, [customer, editingDirty, order])

  useEffect(() => setPortalReady(true), [])
  useEffect(() => {
    setForm(formFromOrder(order, customer))
    setStatusDraft({
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
    })
    setErrors({})
    setMoreOpen(false)
  }, [customer, order])

  function save() {
    const result = updatePreviewOrder({
      workspaceId,
      orderId: order.id,
      changes: formToOrderInput(form),
    })
    if (!result.order) {
      setErrors(result.errors)
      return
    }
    if (customer && form.customerNotes !== (customer.clientNotes ?? '')) {
      updatePreviewCustomer({
        workspaceId,
        customerId: customer.id,
        changes: { clientNotes: form.customerNotes },
      })
    }
    if (customer && form.customerCompany !== (customer.companyName ?? '')) {
      updatePreviewCustomer({
        workspaceId,
        customerId: customer.id,
        changes: { companyName: form.customerCompany },
      })
    }
    setEditing(false)
    onReload()
  }

  function duplicate() {
    const result = duplicatePreviewOrder({ workspaceId, orderId: order.id })
    onReload()
    setMoreOpen(false)
    if (result.order) onSelectOrder(result.order.id)
  }

  function archive() {
    if (
      !window.confirm('Archive this order? It will move to the Archived view.')
    )
      return
    archivePreviewOrder({ workspaceId, orderId: order.id })
    onReload()
    setMoreOpen(false)
  }

  function cancelOrder() {
    if (!window.confirm('Cancel this order?')) return
    cancelPreviewOrder({ workspaceId, orderId: order.id })
    onReload()
    setMoreOpen(false)
  }

  const drawer = (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/55"
      style={{ top: ORDER_OVERLAY_TOP_OFFSET }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) safeClose()
      }}
    >
      <aside className="ml-auto flex h-full w-full max-w-3xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                Order Detail
              </p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-50">
                {order.orderNumber}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {getOrderCustomerLabel(order, customers)} ·{' '}
                {formatCurrency(order.total, order.currency)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelEditing}
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={save}>
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => setEditing(true)}
                    leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                  >
                    Edit
                  </Button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMoreOpen((open) => !open)}
                      className="text-neutral-text-secondary rounded-xl border border-slate-800 p-2 transition hover:bg-white/[0.06] hover:text-white"
                      aria-label="Order actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {moreOpen ? (
                      <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-950 p-1 shadow-2xl">
                        <MenuButton icon={<Copy />} onClick={duplicate}>
                          Duplicate Order
                        </MenuButton>
                        <MenuButton icon={<Archive />} onClick={archive}>
                          Archive Order
                        </MenuButton>
                        <MenuButton
                          icon={<Trash2 />}
                          danger
                          onClick={cancelOrder}
                        >
                          Cancel Order
                        </MenuButton>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={safeClose}
                className="text-neutral-text-secondary rounded-xl p-2 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Close order drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {editing ? (
            <OrderForm
              form={form}
              setForm={setForm}
              errors={errors}
              customers={customers}
              products={products}
              commerceSettings={commerceSettings}
            />
          ) : (
            <OrderDetails
              workspaceId={workspaceId}
              order={order}
              orders={orders}
              customer={customer}
              customers={customers}
              products={products}
              activities={activities}
              canEdit={canEdit}
              onReload={onReload}
              fulfillments={fulfillments}
              statusDraft={statusDraft}
              statusDirty={statusDirty}
              setStatusDraft={setStatusDraft}
              onSelectFulfillment={onSelectFulfillment}
            />
          )}
        </div>
      </aside>
    </div>
  )

  return portalReady ? createPortal(drawer, document.body) : null
}

function OrderDetails({
  workspaceId,
  order,
  orders,
  customer,
  customers,
  products,
  fulfillments,
  activities,
  canEdit,
  onReload,
  statusDraft,
  statusDirty,
  setStatusDraft,
  onSelectFulfillment,
}: {
  workspaceId: string
  order: CommerceOrder
  orders: CommerceOrder[]
  customer: CommerceCustomer | null
  customers: CommerceCustomer[]
  products: CommerceProduct[]
  fulfillments: CommerceFulfillment[]
  activities: CommerceActivity[]
  canEdit: boolean
  onReload: () => void
  statusDraft: {
    status: CommerceOrderStatus
    paymentStatus: CommercePaymentStatus
    fulfillmentStatus: CommerceFulfillmentStatus
  }
  statusDirty: boolean
  setStatusDraft: React.Dispatch<
    React.SetStateAction<{
      status: CommerceOrderStatus
      paymentStatus: CommercePaymentStatus
      fulfillmentStatus: CommerceFulfillmentStatus
    }>
  >
  onSelectFulfillment: (id: string) => void
}) {
  const customerMetrics = getCustomerOrderMetrics({
    customerId: order.customerId,
    orders,
  })
  const [openStatusMenu, setOpenStatusMenu] =
    useState<OrderQuickStatusDomain | null>(null)
  const [pendingStatus, setPendingStatus] =
    useState<PendingStatusConfirmation | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const shippingAddress = getEffectiveShippingAddress(order)
  const financials = calculateOrderFinancialsFromOrder(order, products)
  const companyName = customer
    ? getMeaningfulOptionalIdentityValue(customer.companyName)
    : getMeaningfulOptionalIdentityValue(order.customerSnapshot?.companyName)

  const connectedFulfillment = fulfillments.find(
    (fulfillment) =>
      fulfillment.orderId === order.id && fulfillment.status !== 'CANCELLED',
  )

  function previewStatusChange(
    domain: OrderQuickStatusDomain,
    option: OrderQuickStatusOption,
  ) {
    setStatusDraft((current) => ({
      ...current,
      ...(domain === 'order'
        ? { status: option.value as CommerceOrderStatus }
        : domain === 'payment'
          ? { paymentStatus: option.value as CommercePaymentStatus }
          : { fulfillmentStatus: option.value as CommerceFulfillmentStatus }),
    }))
    setStatusError(null)
    setOpenStatusMenu(null)
    setPendingStatus(null)
  }

  function saveStatusChanges() {
    const result = updateCommerceOrderQuickStatuses({
      workspaceId,
      orderId: order.id,
      statuses: statusDraft,
    })

    if (!result.order) {
      setStatusError(
        Object.values(result.errors)[0] ?? 'Status could not be updated.',
      )
      return
    }
    setStatusError(null)
    setOpenStatusMenu(null)
    setPendingStatus(null)
    onReload()
  }

  function requestStatusChange(
    domain: OrderQuickStatusDomain,
    option: OrderQuickStatusOption,
  ) {
    setOpenStatusMenu(null)
    if (option.requiresConfirmation) {
      setPendingStatus({ domain, option })
      return
    }
    previewStatusChange(domain, option)
  }

  const pendingStatusLabel = pendingStatus
    ? `${pendingStatus.option.label} ${pendingStatus.domain} status`
    : ''

  return (
    <div className="space-y-5">
      <Section title="Order Overview">
        <DescriptionRow label="Order Number" value={order.orderNumber} />
        <DescriptionRow
          label="Customer"
          value={getOrderCustomerLabel(order, customers)}
        />
        <DescriptionRow label="Created" value={formatDate(order.createdAt)} />
        <DescriptionRow label="Updated" value={formatDate(order.updatedAt)} />
      </Section>
      <Section title="Customer">
        <DescriptionRow
          label="Name"
          value={
            customer?.displayName ??
            order.customerSnapshot?.displayName ??
            'Not set'
          }
        />
        {companyName ? (
          <DescriptionRow label="Company" value={companyName} />
        ) : null}
        <DescriptionRow
          label="Email"
          value={customer?.email ?? order.customerSnapshot?.email ?? 'Not set'}
        />
        <DescriptionRow
          label="Phone"
          value={customer?.phone ?? order.customerSnapshot?.phone ?? 'Not set'}
        />
        <DescriptionRow
          label="Customer since"
          value={
            customerMetrics.customerSince
              ? formatDate(customerMetrics.customerSince)
              : 'Not available'
          }
        />
        <DescriptionRow
          label="Total orders"
          value={customerMetrics.totalOrders}
        />
        <DescriptionRow
          label="Lifetime spend"
          value={formatCurrency(customerMetrics.lifetimeSpend, order.currency)}
        />
      </Section>
      <Section title="Addresses">
        <div className="grid gap-3 md:grid-cols-2">
          <AddressDisplay
            title="Billing address"
            address={order.billingAddress}
          />
          {order.shippingSameAsBilling ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
              <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
                Shipping address
              </h4>
              <p className="mt-3 text-sm text-neutral-200">
                Same as billing address
              </p>
            </div>
          ) : (
            <AddressDisplay
              title="Shipping address"
              address={order.shippingAddress}
            />
          )}
        </div>
      </Section>
      <Section title="Status">
        <div className="grid gap-2 sm:grid-cols-3">
          <QuickStatusCard
            label="Order"
            value={statusDraft.status}
            variant={orderStatusVariant[statusDraft.status]}
            options={COMMERCE_ORDER_STATUS_OPTIONS}
            open={openStatusMenu === 'order'}
            onOpenChange={(open) => setOpenStatusMenu(open ? 'order' : null)}
            onSelect={(option) => requestStatusChange('order', option)}
          />
          <QuickStatusCard
            label="Payment"
            value={statusDraft.paymentStatus}
            variant={paymentStatusVariant[statusDraft.paymentStatus]}
            options={COMMERCE_PAYMENT_STATUS_OPTIONS}
            open={openStatusMenu === 'payment'}
            onOpenChange={(open) => setOpenStatusMenu(open ? 'payment' : null)}
            onSelect={(option) => requestStatusChange('payment', option)}
          />
          <QuickStatusCard
            label="Fulfillment"
            value={statusDraft.fulfillmentStatus}
            variant={fulfillmentStatusVariant[statusDraft.fulfillmentStatus]}
            options={COMMERCE_FULFILLMENT_STATUS_OPTIONS}
            open={openStatusMenu === 'fulfillment'}
            onOpenChange={(open) =>
              setOpenStatusMenu(open ? 'fulfillment' : null)
            }
            onSelect={(option) => requestStatusChange('fulfillment', option)}
          />
        </div>
        {statusDirty ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-3">
            <p className="text-sm font-medium text-amber-100">
              Unsaved status changes.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setStatusDraft({
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    fulfillmentStatus: order.fulfillmentStatus,
                  })
                  setStatusError(null)
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveStatusChanges}>
                Save Changes
              </Button>
            </div>
          </div>
        ) : null}
        {statusError ? (
          <p className="text-xs text-rose-300">{statusError}</p>
        ) : null}
        {pendingStatus ? (
          <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="order-status-confirm-title"
            className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-3"
          >
            <h4
              id="order-status-confirm-title"
              className="text-sm font-semibold text-amber-100"
            >
              Confirm status update
            </h4>
            <p className="mt-1 text-xs text-amber-100/80">
              Updating to {pendingStatusLabel} may alter how this order is
              handled.
            </p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPendingStatus(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  previewStatusChange(
                    pendingStatus.domain,
                    pendingStatus.option,
                  )
                }
              >
                Confirm update
              </Button>
            </div>
          </div>
        ) : null}
      </Section>
      <Section title="Items">
        <div className="space-y-2">
          {order.lines.map((line) => {
            const item = getOrderLinePresentation({ line, products })
            return (
              <div
                key={line.id}
                className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-neutral-100">
                        {item.productName}
                      </p>
                      {item.isCustom ? (
                        <Badge variant="slate">Custom item</Badge>
                      ) : null}
                    </div>
                    {item.variantName || item.optionValues.length ? (
                      <p className="mt-1 text-xs text-cyan-100/80">
                        {[item.variantName, ...item.optionValues]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                    <div className="text-neutral-text-secondary mt-3 grid gap-2 text-xs sm:grid-cols-4">
                      <span>SKU: {item.sku}</span>
                      <span>Quantity: {item.quantity}</span>
                      <span>
                        Unit: {formatCurrency(item.unitPrice, order.currency)}
                      </span>
                      <span>
                        Cost:{' '}
                        {item.unitCost == null
                          ? 'Missing'
                          : formatCurrency(item.unitCost, order.currency)}
                      </span>
                      <span>
                        Subtotal:{' '}
                        {formatCurrency(item.subtotal, order.currency)}
                      </span>
                    </div>
                  </div>
                  <p className="font-semibold text-neutral-50">
                    {formatCurrency(line.lineTotal, order.currency)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </Section>
      <Section title="Totals and Profitability">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={order.shippingPayer === 'CUSTOMER' ? 'blue' : 'orange'}
          >
            {formatShippingPayer(order.shippingPayer)}
          </Badge>
          {financials.profitabilityComplete ? (
            <Badge
              variant={
                financials.orderGrossProfit != null &&
                financials.orderGrossProfit < 0
                  ? 'red'
                  : 'green'
              }
            >
              Profit complete
            </Badge>
          ) : (
            <Badge variant="yellow">
              Missing {financials.missingCostCount} cost
              {financials.missingCostCount === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
        <OrderFinancialSummary
          financials={financials}
          currency={order.currency}
        />
      </Section>
      <Section title="Shipping and Delivery">
        <DescriptionRow
          label="Shipping paid by"
          value={formatShippingPayer(order.shippingPayer)}
        />
        <DescriptionRow
          label="Shipping charge"
          value={formatCurrency(
            order.shippingCharge ?? order.shippingTotal,
            order.currency,
          )}
        />
        <DescriptionRow
          label="Shipping cost to business"
          value={
            order.shippingCost == null
              ? 'Not set'
              : formatCurrency(order.shippingCost, order.currency)
          }
        />
        <DescriptionRow
          label="Shipping cost state"
          value={order.shippingCostState ?? 'Not set'}
        />
        <DescriptionRow
          label="Shipping method"
          value={order.shippingMethod ?? 'Not set'}
        />
        <DescriptionRow
          label="Carrier"
          value={order.shippingCarrier ?? 'Not set'}
        />
        <DescriptionRow
          label="Tracking number"
          value={order.trackingNumber ?? 'Not set'}
        />
        <DescriptionRow
          label="Estimated delivery"
          value={
            order.estimatedDelivery
              ? formatDate(order.estimatedDelivery)
              : 'Not set'
          }
        />
        <DescriptionRow
          label="Fulfillment status"
          value={getCommerceStatusLabel(order.fulfillmentStatus)}
        />
        <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
          <p className="text-neutral-text-secondary text-xs">
            Shipping address
          </p>
          <AddressLines className="mt-2" address={shippingAddress} />
        </div>
      </Section>
      <OrderNotesCard
        workspaceId={workspaceId}
        order={order}
        customer={customer}
        canEdit={canEdit}
        onReload={onReload}
      />
      <Section title="Related Records">
        <DescriptionRow
          label="Commerce Customer"
          value={customer?.displayName ?? 'Not linked'}
        />
        {connectedFulfillment ? (
          <RelatedRecordButton
            label="Fulfillment"
            title={connectedFulfillment.fulfillmentNumber}
            description={`${getCommerceStatusLabel(connectedFulfillment.status)} · ${
              connectedFulfillment.assignedTo ?? 'Unassigned'
            }`}
            onClick={() => onSelectFulfillment(connectedFulfillment.id)}
          />
        ) : (
          <p className="text-neutral-text-secondary text-xs">
            No fulfillment record has been created for this order yet.
          </p>
        )}
      </Section>
      <Section title="Timeline">
        {activities.length ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="border-l border-slate-700 pl-3">
                <p className="text-sm font-medium text-neutral-100">
                  {activity.title}
                </p>
                {activity.description ? (
                  <p className="text-neutral-text-secondary text-xs">
                    {activity.description}
                  </p>
                ) : null}
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  {formatDateTime(activity.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-text-secondary text-sm">
            No order activity yet.
          </p>
        )}
      </Section>
      <Section title="Actions">
        <p className="text-neutral-text-secondary text-sm">
          Fulfillment, payment capture, returns, and shipping integrations are
          reserved for later commerce phases. This order remains preview/local
          only.
        </p>
      </Section>
    </div>
  )
}

function OrderNotesCard({
  workspaceId,
  order,
  customer,
  canEdit,
  onReload,
}: {
  workspaceId: string
  order: CommerceOrder
  customer: CommerceCustomer | null
  canEdit: boolean
  onReload: () => void
}) {
  const [editing, setEditing] = useState<'order' | 'customer' | null>(null)
  const [orderNotes, setOrderNotes] = useState(order.orderNotes ?? '')
  const [customerNotes, setCustomerNotes] = useState(
    customer?.clientNotes ?? '',
  )

  useEffect(() => {
    setOrderNotes(order.orderNotes ?? '')
    setCustomerNotes(customer?.clientNotes ?? '')
    setEditing(null)
  }, [customer?.clientNotes, order.id, order.orderNotes])

  function saveOrderNotes() {
    updatePreviewOrder({
      workspaceId,
      orderId: order.id,
      changes: { orderNotes },
    })
    setEditing(null)
    onReload()
  }

  function saveCustomerNotes() {
    if (!customer) return
    updatePreviewCustomer({
      workspaceId,
      customerId: customer.id,
      changes: { clientNotes: customerNotes },
    })
    updatePreviewOrder({
      workspaceId,
      orderId: order.id,
      changes: { customerNotesSnapshot: customerNotes },
    })
    setEditing(null)
    onReload()
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">Notes</h3>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Customer notes follow the customer. Internal order notes stay with
            this order.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <EditableNote
          label="Customer Notes"
          value={customerNotes}
          editing={editing === 'customer'}
          disabled={!customer || !canEdit}
          placeholder="Preference, delivery detail, or relationship context."
          onEdit={() => setEditing('customer')}
          onChange={setCustomerNotes}
          onCancel={() => {
            setCustomerNotes(customer?.clientNotes ?? '')
            setEditing(null)
          }}
          onSave={saveCustomerNotes}
        />
        <EditableNote
          label="Internal Order Notes"
          value={orderNotes}
          editing={editing === 'order'}
          disabled={!canEdit}
          placeholder="Packing note, payment context, or exception detail."
          onEdit={() => setEditing('order')}
          onChange={setOrderNotes}
          onCancel={() => {
            setOrderNotes(order.orderNotes ?? '')
            setEditing(null)
          }}
          onSave={saveOrderNotes}
        />
      </div>
    </section>
  )
}

function EditableNote({
  label,
  value,
  editing,
  disabled,
  placeholder,
  onEdit,
  onChange,
  onCancel,
  onSave,
}: {
  label: string
  value: string
  editing: boolean
  disabled?: boolean
  placeholder: string
  onEdit: () => void
  onChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
          {label}
        </h4>
        {!editing ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onEdit}
            className="text-neutral-text-secondary rounded-lg p-1.5 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Edit ${label}`}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={4}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button type="button" size="xs" onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={onEdit}
          className="mt-2 block min-h-20 w-full rounded-lg border border-slate-800 bg-slate-900/45 p-3 text-left text-sm text-neutral-200 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04] disabled:cursor-default disabled:hover:border-slate-800 disabled:hover:bg-slate-900/45"
        >
          {value || (
            <span className="text-neutral-text-secondary">
              Click to add notes.
            </span>
          )}
        </button>
      )}
    </div>
  )
}

function OrderForm({
  form,
  setForm,
  errors,
  customers,
  products,
  commerceSettings,
  isNewOrder = false,
}: {
  form: OrderFormState
  setForm: (form: OrderFormState) => void
  errors: Record<string, string>
  customers: CommerceCustomer[]
  products: CommerceProduct[]
  commerceSettings: CommercePreviewSettings | null
  isNewOrder?: boolean
}) {
  const update = <TKey extends keyof OrderFormState>(
    key: TKey,
    value: OrderFormState[TKey],
  ) => setForm({ ...form, [key]: value })
  const financials = calculateOrderFinancials({
    lines: form.lines.map((line) => ({
      productId: line.productId || undefined,
      variantId: line.variantId || undefined,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      unitCost: line.unitCost === '' ? undefined : Number(line.unitCost || 0),
      discountType: line.discountType,
      discountValue:
        line.discountType === 'NONE' ? 0 : Number(line.discountValue || 0),
      taxTotal: Number(line.taxTotal || 0),
    })),
    products,
    shippingCharge: Number(form.shippingCharge || 0),
    shippingCost:
      form.shippingCost === '' ? undefined : Number(form.shippingCost || 0),
    shippingPayer: form.shippingPayer,
    currency: form.currency || 'USD',
  })
  const defaultShipping = commerceSettings?.shippingDefaults
  const usingDefaults =
    Boolean(isNewOrder && defaultShipping) &&
    form.shippingPayer === defaultShipping?.payer &&
    form.shippingMethod === (defaultShipping?.method ?? '') &&
    form.shippingCarrier === (defaultShipping?.carrier ?? '') &&
    form.shippingCharge ===
      formatOptionalNumber(defaultShipping?.shippingCharge) &&
    form.shippingCost === formatOptionalNumber(defaultShipping?.shippingCost) &&
    form.shippingCostState === 'ESTIMATED'

  function resetShippingDefaults() {
    if (!defaultShipping) return
    setForm({
      ...form,
      shippingPayer: defaultShipping.payer,
      shippingMethod: defaultShipping.method ?? '',
      shippingCarrier: defaultShipping.carrier ?? '',
      shippingCharge:
        defaultShipping.payer === 'BUSINESS'
          ? '0'
          : formatOptionalNumber(defaultShipping.shippingCharge),
      shippingCost: formatOptionalNumber(defaultShipping.shippingCost),
      shippingCostState: 'ESTIMATED',
      shippingCostTouched: Boolean(defaultShipping.shippingCost != null),
    })
  }

  function updateShippingCharge(value: string) {
    const seeded = maybeSeedEstimatedShippingCostFromCharge({
      payer: form.shippingPayer,
      shippingCharge: value,
      shippingCost: form.shippingCost,
      shippingCostTouched: form.shippingCostTouched,
      shippingCostState: form.shippingCostState,
    })
    setForm({
      ...form,
      shippingCharge: value,
      ...seeded,
    })
  }

  function useChargeAsEstimatedCost() {
    setForm({
      ...form,
      ...useChargeAsEstimatedShippingCost(form.shippingCharge),
    })
  }
  return (
    <div className="space-y-5">
      <Section title="Customer">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Field label="Customer" required>
            <Select
              value={form.createCustomer ? '__new' : form.customerId}
              onChange={(event) => {
                const value = event.target.value
                if (value === '__new') {
                  setForm({ ...form, customerId: '', createCustomer: true })
                  return
                }
                const customer = customers.find((record) => record.id === value)
                setForm({
                  ...form,
                  customerId: value,
                  createCustomer: false,
                  customerName: customer?.displayName ?? '',
                  customerCompany: customer?.companyName ?? '',
                  customerEmail: customer?.email ?? '',
                  customerPhone: customer?.phone ?? '',
                  customerNotes: customer?.clientNotes ?? '',
                })
              }}
              error={errors.customer}
            >
              <option value="">Select customer...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                  {customer.email ? ` · ${customer.email}` : ''}
                </option>
              ))}
              <option value="__new">Create customer inline</option>
            </Select>
          </Field>
          <Button
            type="button"
            variant={form.createCustomer ? 'primary' : 'outline'}
            className="self-end"
            onClick={() => update('createCustomer', !form.createCustomer)}
          >
            {form.createCustomer ? 'New Customer' : 'Create Customer'}
          </Button>
        </div>
        {form.createCustomer ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Customer name" required>
              <Input
                value={form.customerName}
                onChange={(event) => update('customerName', event.target.value)}
                placeholder="NorthStar Electric"
              />
            </Field>
            <Field label="Company">
              <Input
                value={form.customerCompany}
                onChange={(event) =>
                  update('customerCompany', event.target.value)
                }
                placeholder="Optional company or organization"
              />
            </Field>
            <Field label="Email">
              <Input
                value={form.customerEmail}
                onChange={(event) =>
                  update('customerEmail', event.target.value)
                }
                placeholder="owner@northstar.com"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.customerPhone}
                onChange={(event) =>
                  update('customerPhone', event.target.value)
                }
                placeholder="+1 555 555 1234"
              />
            </Field>
          </div>
        ) : form.customerId ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Company">
              <Input
                value={form.customerCompany}
                onChange={(event) =>
                  update('customerCompany', event.target.value)
                }
                placeholder="Optional company or organization"
              />
            </Field>
          </div>
        ) : null}
      </Section>

      <Section title="Addresses">
        <p className="text-neutral-text-secondary text-xs">
          Draft orders can be saved with partial address details. Shipping uses
          the billing snapshot when same-as-billing is enabled.
        </p>
        <div className="grid gap-4 xl:grid-cols-2">
          <AddressFields
            title="Billing address"
            address={form.billingAddress}
            onChange={(billingAddress) =>
              update('billingAddress', billingAddress)
            }
          />
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-sm text-neutral-200">
              <input
                type="checkbox"
                checked={form.shippingSameAsBilling}
                onChange={(event) => {
                  const checked = event.target.checked
                  setForm({
                    ...form,
                    shippingSameAsBilling: checked,
                    shippingAddress:
                      !checked && isAddressFormEmpty(form.shippingAddress)
                        ? form.billingAddress
                        : form.shippingAddress,
                  })
                }}
                className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-cyan-300"
              />
              Shipping address is the same as billing address
            </label>
            {form.shippingSameAsBilling ? (
              <div className="text-neutral-text-secondary rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-sm">
                Shipping will use the billing address saved above.
              </div>
            ) : (
              <AddressFields
                title="Shipping address"
                address={form.shippingAddress}
                onChange={(shippingAddress) =>
                  update('shippingAddress', shippingAddress)
                }
              />
            )}
          </div>
        </div>
      </Section>

      <Section title="Status">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Order Status" required>
            <Select
              value={form.status}
              onChange={(event) =>
                update('status', event.target.value as CommerceOrderStatus)
              }
            >
              {COMMERCE_ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment Status" required>
            <Select
              value={form.paymentStatus}
              onChange={(event) =>
                update(
                  'paymentStatus',
                  event.target.value as CommercePaymentStatus,
                )
              }
            >
              {COMMERCE_PAYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fulfillment Status" required>
            <Select
              value={form.fulfillmentStatus}
              onChange={(event) =>
                update(
                  'fulfillmentStatus',
                  event.target.value as CommerceFulfillmentStatus,
                )
              }
            >
              {COMMERCE_FULFILLMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Products">
        <div className="space-y-3">
          {form.lines.map((line, index) => (
            <OrderLineEditor
              key={line.id}
              line={line}
              index={index}
              products={products}
              error={
                errors[`lines.${index}.name`] ??
                errors[`lines.${index}.quantity`]
              }
              onChange={(nextLine) => {
                const nextLines = form.lines.map((record) =>
                  record.id === line.id ? nextLine : record,
                )
                update('lines', nextLines)
              }}
              onRemove={() =>
                update(
                  'lines',
                  form.lines.length > 1
                    ? form.lines.filter((record) => record.id !== line.id)
                    : [createLine()],
                )
              }
            />
          ))}
        </div>
        {errors.lines ? (
          <p className="mt-2 text-xs text-rose-300">{errors.lines}</p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => update('lines', [...form.lines, createLine()])}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add Item
        </Button>
      </Section>

      <Section title="Order Totals">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Currency">
            <Input
              value={form.currency}
              onChange={(event) =>
                update('currency', event.target.value.toUpperCase())
              }
              placeholder="USD"
            />
          </Field>
        </div>
        <div className="mt-3">
          <OrderFinancialSummary
            financials={financials}
            currency={form.currency || 'USD'}
          />
        </div>
      </Section>

      <Section title="Shipping and Delivery">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {usingDefaults ? (
            <Badge variant="slate">Workspace default</Badge>
          ) : null}
          {defaultShipping ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={resetShippingDefaults}
            >
              Reset to workspace defaults
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Shipping paid by">
            <Select
              value={form.shippingPayer}
              onChange={(event) =>
                update(
                  'shippingPayer',
                  event.target.value as CommerceShippingPayer,
                )
              }
            >
              {shippingPayerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Shipping charge">
            <Input
              type="number"
              {...commerceNumericInputRules.money}
              value={form.shippingCharge}
              onChange={(event) => updateShippingCharge(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <div className="space-y-2">
            <Field
              label="Shipping cost to business"
              helpText={getShippingCostStateHelper(form.shippingCostState)}
            >
              <Input
                type="number"
                {...commerceNumericInputRules.money}
                value={form.shippingCost}
                onChange={(event) =>
                  setForm({
                    ...form,
                    shippingCost: event.target.value,
                    shippingCostTouched: true,
                  })
                }
                placeholder="0.00"
              />
            </Field>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={useChargeAsEstimatedCost}
              disabled={!form.shippingCharge.trim()}
              aria-label="Use shipping charge as the estimated business shipping cost"
            >
              Use charge as estimate
            </Button>
          </div>
          <Field label="Shipping cost state">
            <Select
              value={form.shippingCostState}
              onChange={(event) =>
                update(
                  'shippingCostState',
                  event.target.value as CommerceShippingCostState,
                )
              }
            >
              <option value="ESTIMATED">Estimated</option>
              <option value="ACTUAL">Actual</option>
            </Select>
          </Field>
          <Field label="Shipping method">
            <Input
              value={form.shippingMethod}
              onChange={(event) => update('shippingMethod', event.target.value)}
              placeholder="Ground, pickup, courier..."
            />
          </Field>
          <Field label="Carrier">
            <Input
              value={form.shippingCarrier}
              onChange={(event) =>
                update('shippingCarrier', event.target.value)
              }
              placeholder="Not set"
            />
          </Field>
          <Field label="Tracking number">
            <Input
              value={form.trackingNumber}
              onChange={(event) => update('trackingNumber', event.target.value)}
              placeholder="Not set"
            />
          </Field>
          <Field label="Estimated delivery">
            <Input
              type="date"
              value={form.estimatedDelivery}
              onChange={(event) =>
                update('estimatedDelivery', event.target.value)
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Notes">
        <Field label="Internal Order Notes">
          <Textarea
            value={form.orderNotes}
            onChange={(event) => update('orderNotes', event.target.value)}
            placeholder="Packing details, payment context, or order exceptions."
          />
        </Field>
        <Field label="Customer Notes">
          <Textarea
            value={form.customerNotes}
            onChange={(event) => update('customerNotes', event.target.value)}
            placeholder="Customer preferences or reusable relationship context."
          />
        </Field>
      </Section>
    </div>
  )
}

function OrderLineEditor({
  line,
  index,
  products,
  error,
  onChange,
  onRemove,
}: {
  line: OrderLineForm
  index: number
  products: CommerceProduct[]
  error?: string
  onChange: (line: OrderLineForm) => void
  onRemove: () => void
}) {
  const product = products.find((record) => record.id === line.productId)
  const variant = product?.variants.find(
    (record) => record.id === line.variantId,
  )
  const itemTotals = calculateOrderTotals({
    lines: [
      {
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        unitCost: line.unitCost === '' ? undefined : Number(line.unitCost || 0),
        discountType: line.discountType,
        discountValue:
          line.discountType === 'NONE' ? 0 : Number(line.discountValue || 0),
        taxTotal: Number(line.taxTotal || 0),
      },
    ],
  })

  function applyProduct(productId: string) {
    const nextProduct = products.find((record) => record.id === productId)
    if (!nextProduct) {
      onChange({ ...line, productId: '', variantId: '' })
      return
    }
    const firstVariant = nextProduct.hasVariants
      ? nextProduct.variants[0]
      : undefined
    onChange({
      ...line,
      productId: nextProduct.id,
      variantId: firstVariant?.id ?? '',
      name: firstVariant
        ? `${nextProduct.name} - ${firstVariant.name}`
        : nextProduct.name,
      sku: firstVariant?.sku ?? nextProduct.sku ?? '',
      unitPrice: String((firstVariant?.price ?? nextProduct.price).amount),
      unitCost: formatOptionalNumber(
        firstVariant?.cost?.amount ?? nextProduct.cost?.amount,
      ),
    })
  }

  function applyVariant(variantId: string) {
    const nextVariant = product?.variants.find(
      (record) => record.id === variantId,
    )
    if (!nextVariant || !product) {
      onChange({ ...line, variantId: '' })
      return
    }
    onChange({
      ...line,
      variantId,
      name: `${product.name} - ${nextVariant.name}`,
      sku: nextVariant.sku ?? product.sku ?? '',
      unitPrice: String((nextVariant.price ?? product.price).amount),
      unitCost: formatOptionalNumber(
        nextVariant.cost?.amount ?? product.cost?.amount,
      ),
    })
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(5rem,6rem)_auto]">
        <Field label={`Item ${index + 1}`}>
          <Select
            value={line.productId}
            onChange={(event) => applyProduct(event.target.value)}
            title={product?.name}
          >
            <option value="">Select product...</option>
            {products.map((record) => (
              <option key={record.id} value={record.id}>
                {record.name} · {formatProductPriceRange(record)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Variant / Item">
          {product?.hasVariants && product.variants.length ? (
            <Select
              value={line.variantId}
              onChange={(event) => applyVariant(event.target.value)}
              title={variant?.name}
            >
              <option value="">Select variant...</option>
              {product.variants.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              value={line.name}
              onChange={(event) =>
                onChange({ ...line, name: event.target.value })
              }
              placeholder="Custom item"
            />
          )}
        </Field>
        <Field label="Qty">
          <Input
            type="number"
            {...commerceNumericInputRules.quantity}
            value={line.quantity}
            onChange={(event) =>
              onChange({ ...line, quantity: event.target.value })
            }
            className="text-right"
          />
        </Field>
        <div className="flex items-end justify-end">
          <button
            type="button"
            onClick={onRemove}
            className="text-neutral-text-secondary rounded-xl border border-slate-800 p-2 transition hover:border-rose-300/30 hover:bg-rose-300/[0.06] hover:text-rose-200"
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Unit price">
          <Input
            type="number"
            {...commerceNumericInputRules.money}
            value={line.unitPrice}
            onChange={(event) =>
              onChange({ ...line, unitPrice: event.target.value })
            }
            className="text-right"
          />
        </Field>
        <Field label="Discount type">
          <Select
            value={line.discountType}
            onChange={(event) => {
              const discountType = event.target.value as CommerceDiscountType
              onChange({
                ...line,
                discountType,
                discountValue:
                  discountType === 'NONE' ? '' : line.discountValue,
              })
            }}
          >
            {COMMERCE_DISCOUNT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={
            line.discountType === 'PERCENTAGE' ? 'Discount %' : 'Discount value'
          }
        >
          <Input
            type="number"
            {...(line.discountType === 'PERCENTAGE'
              ? commerceNumericInputRules.percentage
              : commerceNumericInputRules.money)}
            value={line.discountType === 'NONE' ? '' : line.discountValue}
            onChange={(event) =>
              onChange({ ...line, discountValue: event.target.value })
            }
            disabled={line.discountType === 'NONE'}
            placeholder={line.discountType === 'PERCENTAGE' ? '%' : '0.00'}
            className="text-right"
          />
        </Field>
        <Field label="Unit cost">
          <Input
            type="number"
            {...commerceNumericInputRules.money}
            value={line.unitCost}
            onChange={(event) =>
              onChange({ ...line, unitCost: event.target.value })
            }
            placeholder="Cost"
            className="text-right"
          />
        </Field>
        <Field label="Tax">
          <Input
            type="number"
            {...commerceNumericInputRules.money}
            value={line.taxTotal}
            onChange={(event) =>
              onChange({ ...line, taxTotal: event.target.value })
            }
            className="text-right"
          />
        </Field>
        <div className="flex items-end">
          <div className="w-full min-w-0 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-right text-sm font-semibold text-cyan-50">
            <span className="text-neutral-text-secondary block text-[10px] font-medium uppercase tracking-[0.12em]">
              Line total
            </span>
            {formatCurrency(itemTotals.total)}
          </div>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  )
}

function AddressDisplay({
  title,
  address,
}: {
  title: string
  address?: Partial<CommerceAddress>
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
        {title}
      </h4>
      <AddressLines className="mt-3" address={address} />
    </div>
  )
}

function AddressLines({
  address,
  className,
}: {
  address?: Partial<CommerceAddress>
  className?: string
}) {
  const lines = formatCommerceAddressLines(address)
  if (!lines.length) {
    return (
      <p className={cn('text-neutral-text-secondary text-sm', className)}>
        Not provided
      </p>
    )
  }
  return (
    <div className={cn('space-y-1 text-sm text-neutral-200', className)}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
      <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  required,
  helpText,
  children,
}: {
  label: string
  required?: boolean
  helpText?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-neutral-text-secondary text-xs font-medium">
        {label}
        {required ? <span className="text-cyan-300"> *</span> : null}
      </span>
      {children}
      {helpText ? (
        <p className="text-neutral-text-secondary text-xs">{helpText}</p>
      ) : null}
    </label>
  )
}

function AddressFields({
  title,
  address,
  onChange,
}: {
  title: string
  address: AddressFormState
  onChange: (address: AddressFormState) => void
}) {
  const update = <TKey extends keyof AddressFormState>(
    key: TKey,
    value: AddressFormState[TKey],
  ) => onChange({ ...address, [key]: value })

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
        {title}
      </h4>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="Full name">
          <Input
            value={address.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Jordan Lee"
          />
        </Field>
        <Field label="Company">
          <Input
            value={address.company}
            onChange={(event) => update('company', event.target.value)}
            placeholder="NorthStar Electric"
          />
        </Field>
        <Field label="Address line 1">
          <Input
            value={address.line1}
            onChange={(event) => update('line1', event.target.value)}
            placeholder="123 Main Street"
          />
        </Field>
        <Field label="Address line 2">
          <Input
            value={address.line2}
            onChange={(event) => update('line2', event.target.value)}
            placeholder="Suite 200"
          />
        </Field>
        <Field label="City">
          <Input
            value={address.city}
            onChange={(event) => update('city', event.target.value)}
            placeholder="Richmond"
          />
        </Field>
        <Field label="State / Province">
          <Input
            value={address.region}
            onChange={(event) => update('region', event.target.value)}
            placeholder="VA"
          />
        </Field>
        <Field label="Postal code">
          <Input
            value={address.postalCode}
            onChange={(event) => update('postalCode', event.target.value)}
            placeholder="23220"
          />
        </Field>
        <Field label="Country">
          <Input
            value={address.country}
            onChange={(event) => update('country', event.target.value)}
            placeholder="United States"
          />
        </Field>
        <Field label="Phone">
          <Input
            value={address.phone}
            onChange={(event) => update('phone', event.target.value)}
            placeholder="+1 555 555 1234"
          />
        </Field>
      </div>
    </div>
  )
}

function DescriptionRow({
  label,
  value,
  strong,
}: {
  label: string
  value: ReactNode
  strong?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2">
      <span className="text-neutral-text-secondary text-xs">{label}</span>
      <span
        className={cn(
          'text-right text-sm text-neutral-200',
          strong && 'font-semibold text-neutral-50',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function RelatedRecordButton({
  label,
  title,
  description,
  disabled,
  onClick,
}: {
  label: string
  title: string
  description: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.04] disabled:cursor-default disabled:hover:border-slate-800 disabled:hover:bg-slate-950/45"
    >
      <span className="min-w-0">
        <span className="text-neutral-text-secondary block text-xs font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-neutral-100">
          {title}
        </span>
        <span className="text-neutral-text-secondary mt-0.5 block text-xs">
          {description}
        </span>
      </span>
      {!disabled && onClick ? (
        <ChevronDown className="h-4 w-4 -rotate-90 text-cyan-200/80" />
      ) : null}
    </button>
  )
}

function StatusChip({
  label,
  variant,
  children,
}: {
  label: string
  variant: BadgeVariant
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <p className="text-neutral-text-secondary text-xs">{label}</p>
      <Badge className="mt-2" variant={variant}>
        {children}
      </Badge>
    </div>
  )
}

function QuickStatusCard({
  label,
  value,
  variant,
  options,
  open,
  onOpenChange,
  onSelect,
}: {
  label: string
  value: string
  variant: BadgeVariant
  options: readonly OrderQuickStatusOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (option: OrderQuickStatusOption) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const currentOption = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open) return
    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    )
    window.setTimeout(() => optionRefs.current[selectedIndex]?.focus(), 0)
  }, [open, options, value])

  function moveFocus(currentIndex: number, direction: 1 | -1) {
    const nextIndex =
      (currentIndex + direction + options.length) % options.length
    optionRefs.current[nextIndex]?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Update ${label.toLowerCase()} status`}
        onClick={() => onOpenChange(!open)}
        className={cn(
          'w-full rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
          'hover:border-cyan-300/35 hover:bg-cyan-300/[0.05]',
          open && 'border-cyan-300/45 bg-cyan-300/[0.06]',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-neutral-text-secondary text-xs">{label}</p>
            <Badge className="mt-2" variant={variant}>
              {currentOption?.label ?? getCommerceStatusLabel(value)}
            </Badge>
          </div>
          <div className="text-neutral-text-secondary flex items-center gap-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
            <span>Update</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        </div>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={`${label} status options`}
          className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-1 shadow-2xl"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                optionRefs.current[index] = element
              }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => onSelect(option)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  moveFocus(index, 1)
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  moveFocus(index, -1)
                }
                if (event.key === 'Home') {
                  event.preventDefault()
                  optionRefs.current[0]?.focus()
                }
                if (event.key === 'End') {
                  event.preventDefault()
                  optionRefs.current[options.length - 1]?.focus()
                }
              }}
              className={cn(
                'flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                'hover:bg-cyan-300/[0.06]',
                option.value === value && 'bg-cyan-300/[0.08]',
              )}
            >
              <span className="mt-0.5 flex h-4 w-4 items-center justify-center text-cyan-200">
                {option.value === value ? (
                  <Check className="h-3.5 w-3.5" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-neutral-100">
                  {option.label}
                </span>
                <span className="text-neutral-text-secondary mt-0.5 block text-xs leading-snug">
                  {option.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StatusCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <p className="text-neutral-text-secondary text-xs">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-50">{value}</p>
    </div>
  )
}

function OrderFinancialSummary({
  financials,
  currency,
}: {
  financials: OrderFinancialResult
  currency: string
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  return (
    <div className="space-y-3">
      {!financials.profitabilityComplete ? (
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100">
          Incomplete cost data: {financials.missingCostCount} line
          {financials.missingCostCount === 1 ? '' : 's'} missing resolved cost.
        </div>
      ) : null}

      <div className="grid gap-2 md:grid-cols-3">
        <StatusCard
          label="Customer total"
          value={formatCurrency(financials.customerTotal, currency)}
        />
        <StatusCard
          label="Order gross profit"
          value={
            financials.orderGrossProfit == null
              ? 'Not available'
              : formatCurrency(financials.orderGrossProfit, currency)
          }
        />
        <StatusCard
          label="Order margin"
          value={formatMargin(financials.orderMarginPercent)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
          <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
            Customer charges
          </h4>
          <div className="mt-2 space-y-2">
            <DescriptionRow
              label="Merchandise subtotal"
              value={formatCurrency(financials.merchandiseSubtotal, currency)}
            />
            <DescriptionRow
              label="Merchandise discounts"
              value={formatCurrency(financials.merchandiseDiscounts, currency)}
            />
            <DescriptionRow
              label="Tax"
              value={formatCurrency(financials.taxes, currency)}
            />
            <DescriptionRow
              label="Shipping charged"
              value={formatCurrency(financials.shippingRevenue, currency)}
            />
            <DescriptionRow
              label="Customer total"
              value={formatCurrency(financials.customerTotal, currency)}
              strong
            />
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
          <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
            Business costs
          </h4>
          <div className="mt-2 space-y-2">
            <DescriptionRow
              label="COGS"
              value={formatCurrency(financials.costOfGoodsSold, currency)}
            />
            <DescriptionRow
              label="Shipping expense"
              value={formatCurrency(financials.shippingExpense, currency)}
            />
            <DescriptionRow
              label="Total cost"
              value={
                financials.totalCost == null
                  ? 'Not available'
                  : formatCurrency(financials.totalCost, currency)
              }
              strong
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((open) => !open)}
        className="inline-flex items-center rounded-xl border border-slate-800 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      >
        {detailsOpen ? 'Hide calculation details' : 'View calculation details'}
      </button>

      {detailsOpen ? (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/35 p-3">
          <div className="text-neutral-text-secondary space-y-2 text-xs">
            <h4 className="font-semibold uppercase tracking-[0.16em]">
              How calculations work
            </h4>
            <p>
              <span className="font-semibold text-neutral-200">
                Merchandise gross profit
              </span>{' '}
              measures product profitability before shipping.
            </p>
            <p>
              <span className="font-semibold text-neutral-200">
                Order gross profit
              </span>{' '}
              includes shipping revenue and business shipping expense.
            </p>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <DescriptionRow
              label="Merchandise revenue"
              value={formatCurrency(financials.merchandiseRevenue, currency)}
            />
            <DescriptionRow
              label="Shipping revenue"
              value={formatCurrency(financials.shippingRevenue, currency)}
            />
            <DescriptionRow
              label="Total order revenue"
              value={formatCurrency(financials.totalOrderRevenue, currency)}
            />
            <DescriptionRow
              label="Merchandise gross profit"
              value={
                financials.merchandiseGrossProfit == null
                  ? 'Not available'
                  : formatCurrency(financials.merchandiseGrossProfit, currency)
              }
            />
            <DescriptionRow
              label="Merchandise margin"
              value={formatMargin(financials.merchandiseMarginPercent)}
            />
            <DescriptionRow
              label="Order gross profit"
              value={
                financials.orderGrossProfit == null
                  ? 'Not available'
                  : formatCurrency(financials.orderGrossProfit, currency)
              }
            />
            <DescriptionRow
              label="Order margin"
              value={formatMargin(financials.orderMarginPercent)}
            />
          </div>
          <div className="text-neutral-text-secondary grid gap-2 text-xs md:grid-cols-2">
            <p>
              Merchandise margin = merchandise gross profit divided by
              merchandise revenue.
            </p>
            <p>
              Order margin = order gross profit divided by total order revenue.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MenuButton({
  icon,
  children,
  danger,
  onClick,
}: {
  icon: ReactNode
  children: ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-neutral-200 hover:bg-white/[0.06]',
        danger && 'text-rose-200 hover:bg-rose-300/[0.08]',
      )}
    >
      {React.isValidElement(icon)
        ? React.cloneElement(
            icon as React.ReactElement<{ className?: string }>,
            {
              className: 'h-3.5 w-3.5',
            },
          )
        : icon}
      {children}
    </button>
  )
}
