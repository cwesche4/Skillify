'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  ChevronDown,
  Clock3,
  Edit3,
  PackageCheck,
  Plus,
  Search,
  Truck,
  X,
} from 'lucide-react'

import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClearFiltersButton } from '@/components/ui/ClearFiltersButton'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { Textarea } from '@/components/ui/Textarea'
import {
  COMMERCE_FULFILLMENT_PRIORITY_OPTIONS,
  COMMERCE_FULFILLMENT_STATUS_OPTIONS,
  getCommerceStatusLabel,
} from '@/lib/commerce/commerceRegistry'
import {
  buildFulfillmentRecord,
  getFulfillmentStatusChart,
  selectFulfillmentCounts,
  selectFulfillmentRecords,
  type FulfillmentRecord,
  type FulfillmentViewKey,
} from '@/lib/commerce/fulfillmentCatalog'
import { updateCommerceFulfillmentRecordStatus } from '@/lib/commerce/fulfillmentStatusTransitions'
import {
  commercePreviewCustomersChangedEvent,
  commercePreviewFulfillmentsChangedEvent,
  commercePreviewOrdersChangedEvent,
  commercePreviewProductsChangedEvent,
  createPreviewFulfillment,
  getPreviewCustomers,
  getPreviewFulfillment,
  getPreviewFulfillmentActivities,
  getPreviewFulfillments,
  getPreviewOrders,
  getPreviewProducts,
  updatePreviewCustomer,
  updatePreviewFulfillment,
} from '@/lib/commerce/previewCommerceStorage'
import type {
  CommerceActivity,
  CommerceAddress,
  CommerceCustomer,
  CommerceFulfillment,
  CommerceFulfillmentPriority,
  CommerceFulfillmentStatus,
  CommerceOrder,
  CommerceProduct,
} from '@/lib/commerce/types'
import { getOrderCustomerLabel } from '@/lib/commerce/orderCatalog'
import { formatCommerceMoney } from '@/lib/commerce/productPricing'
import { useClearFilters } from '@/hooks/useClearFilters'
import { cn } from '@/lib/utils'

type Props = {
  workspaceId: string
  canEdit?: boolean
}

type FulfillmentStatusOption =
  (typeof COMMERCE_FULFILLMENT_STATUS_OPTIONS)[number]

type FulfillmentFormState = {
  orderId: string
  status: CommerceFulfillmentStatus
  priority: CommerceFulfillmentPriority
  assignedTo: string
  shippingMethod: string
  carrier: string
  trackingNumber: string
  estimatedDelivery: string
  shippedAt: string
  deliveredAt: string
  internalNotes: string
}

const fulfillmentStatusVariant: Record<
  CommerceFulfillmentStatus,
  BadgeVariant
> = {
  UNFULFILLED: 'slate',
  PICKING: 'blue',
  PACKING: 'purple',
  READY_TO_SHIP: 'orange',
  SHIPPED: 'yellow',
  DELIVERED: 'green',
  RETURNED: 'red',
  CANCELLED: 'red',
}

const priorityVariant: Record<CommerceFulfillmentPriority, BadgeVariant> = {
  LOW: 'slate',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
}

const fulfillmentViewTabs: Array<{ id: FulfillmentViewKey; label: string }> = [
  { id: 'all', label: 'All Fulfillments' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'inProgress', label: 'In Progress' },
  { id: 'ready', label: 'Ready to Ship' },
  { id: 'completed', label: 'Completed' },
]

function getFulfillmentStatusForView(
  view: FulfillmentViewKey,
): 'ALL' | CommerceFulfillmentStatus {
  if (view === 'waiting') return 'UNFULFILLED'
  if (view === 'ready') return 'READY_TO_SHIP'
  return 'ALL'
}

const summaryViews: Array<{
  view: FulfillmentViewKey
  label: string
  countKey: keyof ReturnType<typeof selectFulfillmentCounts>
  ariaLabel: string
  tone?: BadgeVariant
}> = [
  {
    view: 'all',
    label: 'Total Fulfillments',
    countKey: 'all',
    ariaLabel: 'Show all fulfillments',
  },
  {
    view: 'waiting',
    label: 'Waiting',
    countKey: 'waiting',
    ariaLabel: 'Show waiting fulfillments',
    tone: 'slate',
  },
  {
    view: 'inProgress',
    label: 'In Progress',
    countKey: 'inProgress',
    ariaLabel: 'Show in-progress fulfillments',
    tone: 'blue',
  },
  {
    view: 'ready',
    label: 'Ready to Ship',
    countKey: 'ready',
    ariaLabel: 'Show ready-to-ship fulfillments',
    tone: 'orange',
  },
  {
    view: 'completed',
    label: 'Completed',
    countKey: 'completed',
    ariaLabel: 'Show completed fulfillments',
    tone: 'green',
  },
]

const tableColumns = [
  'Fulfillment #',
  'Order',
  'Customer',
  'Status',
  'Priority',
  'Assigned To',
  'Shipping Method',
  'Carrier',
  'Created',
  'Updated',
]

const assignmentOptions = [
  'Operations',
  'Warehouse Team',
  'Field Team',
  'Office Team',
  'Skillify AI',
]

const FULFILLMENT_OVERLAY_TOP_OFFSET = 'var(--dashboard-top-bar-height, 3.5rem)'

function formatDate(value?: string) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value?: string) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatCurrency(amount: number | undefined, currency = 'USD') {
  if (amount == null) return 'Not set'
  return formatCommerceMoney({ amount, currency })
}

function toDateInputValue(value?: string) {
  if (!value) return ''
  return value.slice(0, 10)
}

function fulfillmentToForm(
  fulfillment?: CommerceFulfillment | null,
): FulfillmentFormState {
  return {
    orderId: fulfillment?.orderId ?? '',
    status: fulfillment?.status ?? 'UNFULFILLED',
    priority: fulfillment?.priority ?? 'MEDIUM',
    assignedTo: fulfillment?.assignedTo ?? '',
    shippingMethod: fulfillment?.shippingMethod ?? '',
    carrier: fulfillment?.carrier ?? '',
    trackingNumber: fulfillment?.trackingNumber ?? '',
    estimatedDelivery: toDateInputValue(fulfillment?.estimatedDelivery),
    shippedAt: toDateInputValue(fulfillment?.shippedAt),
    deliveredAt: toDateInputValue(fulfillment?.deliveredAt),
    internalNotes: fulfillment?.internalNotes ?? '',
  }
}

function formToFulfillmentInput(form: FulfillmentFormState) {
  return {
    orderId: form.orderId,
    status: form.status,
    priority: form.priority,
    assignedTo: form.assignedTo.trim() || undefined,
    shippingMethod: form.shippingMethod.trim() || undefined,
    carrier: form.carrier.trim() || undefined,
    trackingNumber: form.trackingNumber.trim() || undefined,
    estimatedDelivery: form.estimatedDelivery || undefined,
    shippedAt: form.shippedAt || undefined,
    deliveredAt: form.deliveredAt || undefined,
    internalNotes: form.internalNotes.trim() || undefined,
  }
}

function getShippingAddress(order: CommerceOrder | null) {
  if (!order) return undefined
  if (order.shippingSameAsBilling) return order.billingAddress
  return order.shippingAddress ?? order.billingAddress
}

function getUniqueValues(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  ).sort((first, second) => first.localeCompare(second))
}

function getCommerceRecordHref(
  section: 'orders' | 'customers' | 'products',
  paramName: 'orderId' | 'customerId' | 'productId',
  recordId: string | undefined | null,
) {
  const id = recordId?.trim()
  if (!id || typeof window === 'undefined') return undefined
  const dashboardMatch = window.location.pathname.match(/^\/dashboard\/[^/]+/)
  const dashboardBase = dashboardMatch?.[0] ?? '/dashboard'
  const params = new URLSearchParams({ [paramName]: id })
  return `${dashboardBase}/${section}?${params.toString()}`
}

function serializeFulfillmentForm(form: FulfillmentFormState) {
  return JSON.stringify(form)
}

function isInteractiveRowTarget(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
) {
  if (!(target instanceof HTMLElement)) return false
  const interactive = target.closest(
    'button, input, textarea, select, option, a, [role="button"]',
  )
  return Boolean(interactive && interactive !== currentTarget)
}

export function FulfillmentPage({ workspaceId, canEdit = true }: Props) {
  const [fulfillments, setFulfillments] = useState<CommerceFulfillment[]>([])
  const [orders, setOrders] = useState<CommerceOrder[]>([])
  const [customers, setCustomers] = useState<CommerceCustomer[]>([])
  const [products, setProducts] = useState<CommerceProduct[]>([])
  const [view, setView] = useState<FulfillmentViewKey>('all')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | CommerceFulfillmentStatus>('ALL')
  const [priority, setPriority] = useState<'ALL' | CommerceFulfillmentPriority>(
    'ALL',
  )
  const [assignedTo, setAssignedTo] = useState('ALL')
  const [shippingMethod, setShippingMethod] = useState('ALL')
  const [carrier, setCarrier] = useState('ALL')
  const expectedStatusForView = getFulfillmentStatusForView(view)
  const clearSecondaryFilters = () => {
    setQuery('')
    setStatus(expectedStatusForView)
    setPriority('ALL')
    setAssignedTo('ALL')
    setShippingMethod('ALL')
    setCarrier('ALL')
  }
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      query,
      status: status === expectedStatusForView ? '' : status,
      priority: priority === 'ALL' ? '' : priority,
      assignedTo: assignedTo === 'ALL' ? '' : assignedTo,
      shippingMethod: shippingMethod === 'ALL' ? '' : shippingMethod,
      carrier: carrier === 'ALL' ? '' : carrier,
    },
    onClear: clearSecondaryFilters,
  })
  const applyView = (nextView: FulfillmentViewKey) => {
    setView(nextView)
    setQuery('')
    setStatus(getFulfillmentStatusForView(nextView))
    setPriority('ALL')
    setAssignedTo('ALL')
    setShippingMethod('ALL')
    setCarrier('ALL')
  }
  const applyStatus = (nextStatus: 'ALL' | CommerceFulfillmentStatus) => {
    setStatus(nextStatus)
  }
  const [selectedFulfillment, setSelectedFulfillment] =
    useState<CommerceFulfillment | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const reload = useCallback(() => {
    setFulfillments(getPreviewFulfillments(workspaceId))
    setOrders(getPreviewOrders(workspaceId))
    setCustomers(getPreviewCustomers(workspaceId))
    setProducts(getPreviewProducts(workspaceId))
  }, [workspaceId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail
      if (!detail?.workspaceId || detail.workspaceId === workspaceId) reload()
    }
    window.addEventListener(commercePreviewFulfillmentsChangedEvent, onChanged)
    window.addEventListener(commercePreviewOrdersChangedEvent, onChanged)
    window.addEventListener(commercePreviewCustomersChangedEvent, onChanged)
    window.addEventListener(commercePreviewProductsChangedEvent, onChanged)
    window.addEventListener('storage', onChanged)
    return () => {
      window.removeEventListener(
        commercePreviewFulfillmentsChangedEvent,
        onChanged,
      )
      window.removeEventListener(commercePreviewOrdersChangedEvent, onChanged)
      window.removeEventListener(
        commercePreviewCustomersChangedEvent,
        onChanged,
      )
      window.removeEventListener(commercePreviewProductsChangedEvent, onChanged)
      window.removeEventListener('storage', onChanged)
    }
  }, [reload, workspaceId])

  const counts = useMemo(
    () => selectFulfillmentCounts(fulfillments),
    [fulfillments],
  )
  const rows = useMemo(
    () =>
      selectFulfillmentRecords({
        fulfillments,
        orders,
        customers,
        products,
        filters: {
          view,
          query,
          status,
          priority,
          assignedTo,
          shippingMethod,
          carrier,
        },
      }),
    [
      assignedTo,
      carrier,
      customers,
      fulfillments,
      orders,
      priority,
      products,
      query,
      shippingMethod,
      status,
      view,
    ],
  )
  const fulfillmentById = useMemo(
    () =>
      new Map(fulfillments.map((fulfillment) => [fulfillment.id, fulfillment])),
    [fulfillments],
  )
  const resolvedSelectedFulfillment = selectedFulfillment
    ? (fulfillmentById.get(selectedFulfillment.id) ??
      getPreviewFulfillment(workspaceId, selectedFulfillment.id) ??
      selectedFulfillment)
    : null
  const assignedOptions = useMemo(
    () =>
      getUniqueValues([
        ...assignmentOptions,
        ...fulfillments.map((item) => item.assignedTo),
      ]),
    [fulfillments],
  )
  const shippingMethodOptions = useMemo(
    () =>
      getUniqueValues([
        ...fulfillments.map((item) => item.shippingMethod),
        ...orders.map((order) => order.shippingMethod),
      ]),
    [fulfillments, orders],
  )
  const carrierOptions = useMemo(
    () =>
      getUniqueValues([
        ...fulfillments.map((item) => item.carrier),
        ...orders.map((order) => order.shippingCarrier),
      ]),
    [fulfillments, orders],
  )
  const statusChart = useMemo(
    () => getFulfillmentStatusChart(fulfillments),
    [fulfillments],
  )
  const openFulfillment = useCallback((fulfillment: CommerceFulfillment) => {
    if (process.env.NODE_ENV !== 'production' && !fulfillment.id.trim()) {
      throw new Error(
        `Fulfillment ${fulfillment.fulfillmentNumber} rendered without a stable ID`,
      )
    }
    setSelectedFulfillment(fulfillment)
  }, [])

  if (process.env.NODE_ENV !== 'production') {
    rows.forEach((record) => {
      if (!record.fulfillment.id.trim()) {
        throw new Error(
          `Fulfillment ${record.fulfillment.fulfillmentNumber} rendered without a stable ID`,
        )
      }
    })
  }

  return (
    <main className="text-neutral-text-primary min-h-screen bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
              Product & Commerce
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-50">
              Fulfillment
            </h1>
            <p className="text-neutral-text-secondary mt-1 max-w-2xl text-sm">
              Coordinate picking, packing, shipping, assignment, tracking, and
              delivery work without running inventory automation yet.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!canEdit}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create Fulfillment
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
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
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
          <Card className="rounded-2xl border-slate-800 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-100">
                  Fulfillment Status
                </h2>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  Live preview counts by native fulfillment lifecycle state.
                </p>
              </div>
              <Badge variant="blue">Preview local</Badge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {statusChart.length ? (
                statusChart.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"
                  >
                    <p className="text-neutral-text-secondary text-xs">
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-neutral-50">
                      {item.value}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-neutral-text-secondary text-sm">
                  Create a fulfillment from an order to populate status data.
                </p>
              )}
            </div>
          </Card>
          <Card className="rounded-2xl border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-neutral-100">
              Average Fulfillment Time
            </h2>
            <p className="mt-2 text-2xl font-semibold text-cyan-200">
              Coming Later
            </p>
            <p className="text-neutral-text-secondary mt-1 text-xs">
              Timestamp analytics will become meaningful once fulfillment
              milestones are automated and persisted.
            </p>
          </Card>
        </div>

        <Card className="rounded-2xl border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {fulfillmentViewTabs.map((tab) => (
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

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr_0.9fr_0.9fr]">
            <label className="relative">
              <Search className="text-neutral-text-secondary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search fulfillment, order, customer, tracking..."
                className="pl-9"
              />
            </label>
            <Select
              value={status}
              onChange={(event) =>
                applyStatus(
                  event.target.value as 'ALL' | CommerceFulfillmentStatus,
                )
              }
            >
              <option value="ALL">All statuses</option>
              {COMMERCE_FULFILLMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value as 'ALL' | CommerceFulfillmentPriority,
                )
              }
            >
              <option value="ALL">All priorities</option>
              {COMMERCE_FULFILLMENT_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
            >
              <option value="ALL">All assignees</option>
              {assignedOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select
              value={shippingMethod}
              onChange={(event) => setShippingMethod(event.target.value)}
            >
              <option value="ALL">All methods</option>
              {shippingMethodOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
            >
              <option value="ALL">All carriers</option>
              {carrierOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  {tableColumns.map((column) => (
                    <TH key={column}>{column}</TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {rows.length ? (
                  rows.map((record) => (
                    <TR
                      key={record.fulfillment.id}
                      className="cursor-pointer"
                      data-fulfillment-id={record.fulfillment.id}
                      data-fulfillment-number={
                        record.fulfillment.fulfillmentNumber
                      }
                      tabIndex={0}
                      role="button"
                      aria-label={`Open fulfillment ${record.fulfillment.fulfillmentNumber}`}
                      onClick={(event) => {
                        if (
                          isInteractiveRowTarget(
                            event.target,
                            event.currentTarget,
                          )
                        )
                          return
                        openFulfillment(record.fulfillment)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openFulfillment(record.fulfillment)
                        }
                      }}
                    >
                      <TD>
                        <div className="font-medium text-neutral-100">
                          {record.fulfillment.fulfillmentNumber}
                        </div>
                        {record.fulfillment.trackingNumber ? (
                          <p className="text-neutral-text-secondary text-xs">
                            {record.fulfillment.trackingNumber}
                          </p>
                        ) : null}
                      </TD>
                      <TD>
                        {record.order?.orderNumber ?? 'Order unavailable'}
                      </TD>
                      <TD>{record.customerLabel}</TD>
                      <TD>
                        <Badge
                          variant={
                            fulfillmentStatusVariant[record.fulfillment.status]
                          }
                        >
                          {getCommerceStatusLabel(record.fulfillment.status)}
                        </Badge>
                      </TD>
                      <TD>
                        <Badge
                          variant={priorityVariant[record.fulfillment.priority]}
                        >
                          {COMMERCE_FULFILLMENT_PRIORITY_OPTIONS.find(
                            (option) =>
                              option.value === record.fulfillment.priority,
                          )?.label ?? record.fulfillment.priority}
                        </Badge>
                      </TD>
                      <TD>{record.fulfillment.assignedTo ?? 'Unassigned'}</TD>
                      <TD>
                        {record.fulfillment.shippingMethod ??
                          record.order?.shippingMethod ??
                          'Not set'}
                      </TD>
                      <TD>
                        {record.fulfillment.carrier ??
                          record.order?.shippingCarrier ??
                          'Not set'}
                      </TD>
                      <TD>{formatDate(record.fulfillment.createdAt)}</TD>
                      <TD>{formatDate(record.fulfillment.updatedAt)}</TD>
                    </TR>
                  ))
                ) : (
                  <TR>
                    <TD colSpan={tableColumns.length}>
                      <div className="flex flex-col items-center justify-center py-14 text-center">
                        <PackageCheck className="h-10 w-10 text-cyan-300/60" />
                        <h2 className="mt-3 text-base font-semibold text-neutral-100">
                          No fulfillments match this view.
                        </h2>
                        <p className="text-neutral-text-secondary mt-1 max-w-md text-sm">
                          Create a preview fulfillment from an order or adjust
                          filters to review operational work.
                        </p>
                        <Button
                          type="button"
                          className="mt-4"
                          onClick={() => setAddOpen(true)}
                          disabled={!canEdit}
                        >
                          Create Fulfillment
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
        <CreateFulfillmentModal
          workspaceId={workspaceId}
          orders={orders}
          customers={customers}
          fulfillments={fulfillments}
          onClose={() => setAddOpen(false)}
          onCreated={(fulfillmentId) => {
            reload()
            setAddOpen(false)
            const fulfillment = getPreviewFulfillment(
              workspaceId,
              fulfillmentId,
            )
            if (fulfillment) setSelectedFulfillment(fulfillment)
          }}
        />
      ) : null}
      {resolvedSelectedFulfillment ? (
        <FulfillmentDrawer
          workspaceId={workspaceId}
          fulfillment={resolvedSelectedFulfillment}
          orders={orders}
          customers={customers}
          products={products}
          canEdit={canEdit}
          onClose={() => setSelectedFulfillment(null)}
          onReload={() => {
            reload()
          }}
          onSelectFulfillment={(fulfillmentId) => {
            const fulfillment =
              fulfillmentById.get(fulfillmentId) ??
              getPreviewFulfillment(workspaceId, fulfillmentId)
            if (fulfillment) setSelectedFulfillment(fulfillment)
          }}
        />
      ) : null}
    </main>
  )
}

function CreateFulfillmentModal({
  workspaceId,
  orders,
  customers,
  fulfillments,
  onClose,
  onCreated,
}: {
  workspaceId: string
  orders: CommerceOrder[]
  customers: CommerceCustomer[]
  fulfillments: CommerceFulfillment[]
  onClose: () => void
  onCreated: (fulfillmentId: string) => void
}) {
  const [form, setForm] = useState<FulfillmentFormState>(() =>
    fulfillmentToForm(),
  )
  const [error, setError] = useState<string | null>(null)
  const availableOrders = orders.filter(
    (order) =>
      !order.archivedAt &&
      order.status !== 'CANCELLED' &&
      !fulfillments.some(
        (fulfillment) =>
          fulfillment.orderId === order.id &&
          fulfillment.status !== 'CANCELLED',
      ),
  )

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = createPreviewFulfillment({
      workspaceId,
      input: formToFulfillmentInput(form),
    })
    if (!result.fulfillment) {
      setError(
        Object.values(result.errors)[0] ?? 'Fulfillment could not be created.',
      )
      return
    }
    onCreated(result.fulfillment.id)
  }

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      style={{ top: FULFILLMENT_OVERLAY_TOP_OFFSET }}
    >
      <form
        onSubmit={submit}
        className="flex max-h-[calc(100dvh-var(--dashboard-top-bar-height,3.5rem)-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-950 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
              Fulfillment
            </p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-50">
              Create Fulfillment
            </h2>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              Create a preview operational record from an existing order.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary rounded-xl p-2 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close create fulfillment modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <Field label="Order" required>
            <Select
              value={form.orderId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  orderId: event.target.value,
                }))
              }
              required
              disabled={availableOrders.length === 0}
            >
              <option value="">Select order...</option>
              {availableOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} -{' '}
                  {getOrderCustomerLabel(order, customers)} -{' '}
                  {getCommerceStatusLabel(order.status)} -{' '}
                  {getCommerceStatusLabel(order.fulfillmentStatus)} -{' '}
                  {order.lines.length} item{order.lines.length === 1 ? '' : 's'}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Priority">
              <Select
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as CommerceFulfillmentPriority,
                  }))
                }
              >
                {COMMERCE_FULFILLMENT_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned To">
              <Select
                value={form.assignedTo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    assignedTo: event.target.value,
                  }))
                }
              >
                <option value="">Unassigned</option>
                {assignmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {availableOrders.length === 0 ? (
            <p className="text-neutral-text-secondary rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-sm">
              Every eligible current order already has an active preview
              fulfillment record. Add another order to create more fulfillment
              work.
            </p>
          ) : null}
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>
        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-slate-800 bg-slate-950 p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!form.orderId || availableOrders.length === 0}
          >
            Create Fulfillment
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

export function FulfillmentDrawer({
  workspaceId,
  fulfillment,
  orders,
  customers,
  products,
  canEdit,
  onClose,
  onReload,
  onSelectFulfillment,
  onSelectOrder,
}: {
  workspaceId: string
  fulfillment: CommerceFulfillment
  orders: CommerceOrder[]
  customers: CommerceCustomer[]
  products: CommerceProduct[]
  canEdit: boolean
  onClose: () => void
  onReload: () => void
  onSelectFulfillment: (fulfillmentId: string) => void
  onSelectOrder?: (orderId: string) => void
}) {
  const [portalReady, setPortalReady] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FulfillmentFormState>(() =>
    fulfillmentToForm(fulfillment),
  )
  const [statusDraft, setStatusDraft] = useState<CommerceFulfillmentStatus>(
    fulfillment.status,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const initialForm = fulfillmentToForm(fulfillment)
  const formDirty =
    editing &&
    serializeFulfillmentForm(form) !== serializeFulfillmentForm(initialForm)
  const statusDirty = statusDraft !== fulfillment.status

  const safeClose = useCallback(() => {
    if (
      (statusDirty || formDirty) &&
      !window.confirm('Discard unsaved fulfillment changes?')
    ) {
      return
    }
    onClose()
  }, [formDirty, onClose, statusDirty])

  useEffect(() => setPortalReady(true), [])
  useEffect(() => {
    setForm(fulfillmentToForm(fulfillment))
    setStatusDraft(fulfillment.status)
    setErrors({})
  }, [fulfillment])
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') safeClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [safeClose])

  const order =
    orders.find((record) => record.id === fulfillment.orderId) ?? null
  const record = buildFulfillmentRecord({
    fulfillment,
    orders,
    customers,
    products,
  })
  const activities = getPreviewFulfillmentActivities(
    workspaceId,
    fulfillment.id,
  )
  const headerContext = order
    ? `Order ${order.orderNumber} · ${record.customerLabel}`
    : `Order unavailable · ${record.customerLabel}`

  function save() {
    const result = updatePreviewFulfillment({
      workspaceId,
      fulfillmentId: fulfillment.id,
      changes: formToFulfillmentInput(form),
    })
    if (!result.fulfillment) {
      setErrors(
        Object.fromEntries(
          Object.entries(result.errors).filter(([, value]) => value),
        ),
      )
      return
    }
    setErrors({})
    setEditing(false)
    onReload()
    onSelectFulfillment(result.fulfillment.id)
  }

  const drawer = (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/55 backdrop-blur-sm"
      style={{ top: FULFILLMENT_OVERLAY_TOP_OFFSET }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) safeClose()
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Fulfillment ${fulfillment.fulfillmentNumber}`}
        className="ml-auto flex h-full w-full max-w-3xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl"
      >
        <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                FULFILLMENT
              </p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-50">
                {fulfillment.fulfillmentNumber}
              </h2>
              <div className="text-neutral-text-secondary mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm">
                <p className="min-w-0 truncate">{headerContext}</p>
                <Badge
                  className="shrink-0"
                  variant={fulfillmentStatusVariant[fulfillment.status]}
                >
                  {getCommerceStatusLabel(fulfillment.status)}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {editing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(false)
                      setForm(initialForm)
                      setErrors({})
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={save}>
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              )}
              <button
                type="button"
                onClick={safeClose}
                className="text-neutral-text-secondary rounded-xl p-2 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Close fulfillment drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {editing ? (
            <FulfillmentForm form={form} setForm={setForm} errors={errors} />
          ) : (
            <FulfillmentDetails
              workspaceId={workspaceId}
              fulfillment={fulfillment}
              record={record}
              order={order}
              activities={activities}
              canEdit={canEdit}
              onReload={onReload}
              onSelectOrder={onSelectOrder}
              statusDraft={statusDraft}
              statusDirty={statusDirty}
              setStatusDraft={setStatusDraft}
            />
          )}
        </div>
      </aside>
    </div>
  )

  return portalReady ? createPortal(drawer, document.body) : null
}

function FulfillmentDetails({
  workspaceId,
  fulfillment,
  record,
  order,
  activities,
  canEdit,
  onReload,
  onSelectOrder,
  statusDraft,
  statusDirty,
  setStatusDraft,
}: {
  workspaceId: string
  fulfillment: CommerceFulfillment
  record: FulfillmentRecord
  order: CommerceOrder | null
  activities: CommerceActivity[]
  canEdit: boolean
  onReload: () => void
  onSelectOrder?: (orderId: string) => void
  statusDraft: CommerceFulfillmentStatus
  statusDirty: boolean
  setStatusDraft: React.Dispatch<
    React.SetStateAction<CommerceFulfillmentStatus>
  >
}) {
  const [statusOpen, setStatusOpen] = useState(false)
  const [pendingStatus, setPendingStatus] =
    useState<FulfillmentStatusOption | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  function previewStatus(option: FulfillmentStatusOption) {
    setStatusDraft(option.value)
    setStatusError(null)
    setStatusOpen(false)
    setPendingStatus(null)
  }

  function saveStatus() {
    const result = updateCommerceFulfillmentRecordStatus({
      workspaceId,
      fulfillmentId: fulfillment.id,
      status: statusDraft,
    })
    if (!result.fulfillment) {
      setStatusError(
        Object.values(result.errors)[0] ?? 'Status could not be updated.',
      )
      return
    }
    setStatusError(null)
    setStatusOpen(false)
    setPendingStatus(null)
    onReload()
  }

  function requestStatus(option: FulfillmentStatusOption) {
    setStatusOpen(false)
    if (option.requiresConfirmation) {
      setPendingStatus(option)
      return
    }
    previewStatus(option)
  }

  return (
    <div className="space-y-5">
      <Section title="Fulfillment Details">
        <DescriptionRow
          label="Fulfillment Number"
          value={fulfillment.fulfillmentNumber}
        />
        <DescriptionRow
          label="Created"
          value={formatDate(fulfillment.createdAt)}
        />
        <DescriptionRow
          label="Updated"
          value={formatDate(fulfillment.updatedAt)}
        />
        <DescriptionRow
          label="Assigned To"
          value={fulfillment.assignedTo ?? 'Unassigned'}
        />
        <DescriptionRow
          label="Priority"
          value={
            COMMERCE_FULFILLMENT_PRIORITY_OPTIONS.find(
              (option) => option.value === fulfillment.priority,
            )?.label ?? fulfillment.priority
          }
        />
      </Section>

      <Section title="Status">
        <div className="grid gap-2 sm:grid-cols-2">
          <QuickStatusCard
            label="Fulfillment"
            value={statusDraft}
            variant={fulfillmentStatusVariant[statusDraft]}
            options={COMMERCE_FULFILLMENT_STATUS_OPTIONS}
            open={statusOpen}
            onOpenChange={setStatusOpen}
            onSelect={requestStatus}
            disabled={!canEdit}
          />
          <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
            <p className="text-neutral-text-secondary text-xs">
              Operational stage
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm text-neutral-100">
              <Clock3 className="h-4 w-4 text-cyan-200/80" />
              {getCommerceStatusLabel(statusDraft)}
            </div>
          </div>
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
                  setStatusDraft(fulfillment.status)
                  setStatusError(null)
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveStatus}>
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
            aria-labelledby="fulfillment-status-confirm-title"
            className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-3"
          >
            <h4
              id="fulfillment-status-confirm-title"
              className="text-sm font-semibold text-amber-100"
            >
              Confirm fulfillment update
            </h4>
            <p className="mt-1 text-xs text-amber-100/80">
              Updating to {pendingStatus.label} may alter how this fulfillment
              is handled.
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
                onClick={() => previewStatus(pendingStatus)}
              >
                Confirm update
              </Button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Order">
        <DescriptionRow
          label="Order Number"
          value={order?.orderNumber ?? 'Order unavailable'}
        />
        <DescriptionRow
          label="Order Status"
          value={order ? getCommerceStatusLabel(order.status) : 'Not available'}
        />
        <DescriptionRow
          label="Payment Status"
          value={
            order
              ? getCommerceStatusLabel(order.paymentStatus)
              : 'Not available'
          }
        />
        <DescriptionRow
          label="Order Total"
          value={
            order
              ? formatCurrency(order.total, order.currency)
              : 'Not available'
          }
        />
      </Section>

      <Section title="Customer">
        <DescriptionRow label="Customer" value={record.customerLabel} />
        <DescriptionRow
          label="Email"
          value={
            record.customer?.email ??
            order?.customerSnapshot?.email ??
            'Not set'
          }
        />
        <DescriptionRow
          label="Phone"
          value={
            record.customer?.phone ??
            order?.customerSnapshot?.phone ??
            'Not set'
          }
        />
      </Section>

      <Section title="Items">
        <div className="space-y-2">
          {record.items.length ? (
            record.items.map((item) => (
              <div
                key={item.line.id}
                className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-100">
                      {item.productName}
                    </p>
                    {item.variantName ? (
                      <p className="mt-1 text-xs text-cyan-100/80">
                        {item.variantName}
                      </p>
                    ) : null}
                    <p className="text-neutral-text-secondary mt-2 text-xs">
                      SKU: {item.sku}
                    </p>
                  </div>
                  <div className="text-neutral-text-secondary grid gap-2 text-xs sm:grid-cols-3">
                    <span>Qty Ordered: {item.qtyOrdered}</span>
                    <span>Qty Fulfilled: {item.qtyFulfilled}</span>
                    <span>Qty Remaining: {item.qtyRemaining}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-neutral-text-secondary text-sm">
              Order line items are unavailable for this fulfillment.
            </p>
          )}
        </div>
      </Section>

      <Section title="Shipping & Delivery">
        <DescriptionRow
          label="Shipping Method"
          value={
            fulfillment.shippingMethod ?? order?.shippingMethod ?? 'Not set'
          }
        />
        <DescriptionRow
          label="Carrier"
          value={fulfillment.carrier ?? order?.shippingCarrier ?? 'Not set'}
        />
        <DescriptionRow
          label="Shipping paid by"
          value={
            order
              ? order.shippingPayer === 'BUSINESS'
                ? 'Business-paid shipping'
                : 'Customer-paid shipping'
              : 'Not set'
          }
        />
        <DescriptionRow
          label="Shipping charge"
          value={
            order
              ? formatCurrency(
                  order.shippingCharge ?? order.shippingTotal,
                  order.currency,
                )
              : 'Not set'
          }
        />
        <DescriptionRow
          label="Actual shipping cost"
          value={
            order
              ? formatCurrency(order.shippingCost, order.currency)
              : 'Not set'
          }
        />
        <div className="grid gap-3 md:grid-cols-2">
          <AddressDisplay
            title="Shipping address"
            address={getShippingAddress(order)}
          />
          <AddressDisplay
            title="Billing address"
            address={order?.billingAddress}
          />
        </div>
      </Section>

      <Section title="Tracking">
        <DescriptionRow
          label="Tracking Number"
          value={fulfillment.trackingNumber ?? 'Not set'}
        />
        <DescriptionRow
          label="Estimated Delivery"
          value={formatDate(
            fulfillment.estimatedDelivery ?? order?.estimatedDelivery,
          )}
        />
        <DescriptionRow
          label="Shipped Date"
          value={formatDate(fulfillment.shippedAt)}
        />
        <DescriptionRow
          label="Delivered Date"
          value={formatDate(fulfillment.deliveredAt)}
        />
      </Section>

      <FulfillmentNotesCard
        workspaceId={workspaceId}
        fulfillment={fulfillment}
        customer={record.customer}
        canEdit={canEdit}
        onReload={onReload}
      />

      <Section title="Related Records">
        {order ? (
          <RelatedRecordButton
            label="Connected Order"
            title={order.orderNumber}
            description={`${record.customerLabel} · ${getCommerceStatusLabel(order.status)}`}
            onClick={onSelectOrder ? () => onSelectOrder(order.id) : undefined}
            href={
              onSelectOrder
                ? undefined
                : getCommerceRecordHref('orders', 'orderId', order.id)
            }
          />
        ) : (
          <DescriptionRow label="Connected Order" value="Order unavailable" />
        )}
        <RelatedRecordButton
          label="Commerce Customer"
          title={record.customerLabel}
          description={
            record.customer?.email ??
            order?.customerSnapshot?.email ??
            'Open commerce customer context'
          }
          href={getCommerceRecordHref(
            'customers',
            'customerId',
            record.customer?.id ?? fulfillment.customerId ?? order?.customerId,
          )}
        />
        {record.items.length ? (
          <div className="space-y-2">
            {record.items.map((item, index) => (
              <RelatedRecordButton
                key={`${item.line.id}-${item.line.productId ?? index}`}
                label={
                  record.items.length === 1 ? 'Product' : `Product ${index + 1}`
                }
                title={item.productName}
                description={[
                  item.variantName,
                  item.sku ? `SKU ${item.sku}` : null,
                  `Qty ${item.qtyOrdered}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                href={getCommerceRecordHref(
                  'products',
                  'productId',
                  item.line.productId,
                )}
              />
            ))}
          </div>
        ) : (
          <DescriptionRow label="Products" value="Not available" />
        )}
      </Section>

      <Section title="Timeline">
        <TimelineList
          activities={activities}
          empty="No fulfillment activity yet."
        />
      </Section>

      <Section title="Actions">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            'Print Shipping Label',
            'Create Carrier Shipment',
            'Create Packing Slip',
          ].map((action) => (
            <Button key={action} type="button" variant="outline" disabled>
              {action} (Coming Later)
            </Button>
          ))}
        </div>
      </Section>
    </div>
  )
}

function TimelineList({
  activities,
  empty,
}: {
  activities: CommerceActivity[]
  empty: string
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? activities : activities.slice(0, 3)

  if (!activities.length) {
    return <p className="text-neutral-text-secondary text-sm">{empty}</p>
  }

  return (
    <div className="space-y-3">
      {activities.length > 3 ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/[0.08]"
          >
            {expanded ? 'Show recent' : 'Show all'}
          </button>
        </div>
      ) : null}
      <div className="space-y-3">
        {visible.map((activity) => (
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
    </div>
  )
}

function FulfillmentNotesCard({
  workspaceId,
  fulfillment,
  customer,
  canEdit,
  onReload,
}: {
  workspaceId: string
  fulfillment: CommerceFulfillment
  customer: CommerceCustomer | null
  canEdit: boolean
  onReload: () => void
}) {
  const [editing, setEditing] = useState<'customer' | 'internal' | null>(null)
  const [customerNotes, setCustomerNotes] = useState(
    customer?.clientNotes ?? '',
  )
  const [internalNotes, setInternalNotes] = useState(
    fulfillment.internalNotes ?? '',
  )

  useEffect(() => {
    setCustomerNotes(customer?.clientNotes ?? '')
    setInternalNotes(fulfillment.internalNotes ?? '')
    setEditing(null)
  }, [customer?.clientNotes, fulfillment.id, fulfillment.internalNotes])

  function saveCustomerNotes() {
    if (!customer) return
    updatePreviewCustomer({
      workspaceId,
      customerId: customer.id,
      changes: { clientNotes: customerNotes },
    })
    updatePreviewFulfillment({
      workspaceId,
      fulfillmentId: fulfillment.id,
      changes: { customerNotesSnapshot: customerNotes },
      activity: { title: 'Customer Notes updated' },
    })
    setEditing(null)
    onReload()
  }

  function saveInternalNotes() {
    updatePreviewFulfillment({
      workspaceId,
      fulfillmentId: fulfillment.id,
      changes: { internalNotes },
      activity: { title: 'Internal fulfillment notes updated' },
    })
    setEditing(null)
    onReload()
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/35 p-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-100">Notes</h3>
        <p className="text-neutral-text-secondary mt-1 text-xs">
          Customer notes are shared throughout the customer relationship.
          Internal notes stay with this fulfillment.
        </p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <EditableNote
          label="Customer Notes"
          helper="Shared throughout the customer relationship."
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
          label="Internal Fulfillment Notes"
          helper="Operational notes for this fulfillment."
          value={internalNotes}
          editing={editing === 'internal'}
          disabled={!canEdit}
          placeholder="Picking notes, packing requirements, carrier handoff details..."
          onEdit={() => setEditing('internal')}
          onChange={setInternalNotes}
          onCancel={() => {
            setInternalNotes(fulfillment.internalNotes ?? '')
            setEditing(null)
          }}
          onSave={saveInternalNotes}
        />
      </div>
    </section>
  )
}

function EditableNote({
  label,
  helper,
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
  helper: string
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
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
            {label}
          </h4>
          <p className="text-neutral-text-secondary mt-1 text-xs">{helper}</p>
        </div>
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

function FulfillmentForm({
  form,
  setForm,
  errors,
}: {
  form: FulfillmentFormState
  setForm: React.Dispatch<React.SetStateAction<FulfillmentFormState>>
  errors: Record<string, string>
}) {
  const update = <K extends keyof FulfillmentFormState>(
    key: K,
    value: FulfillmentFormState[K],
  ) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="space-y-5">
      <Section title="Assignment">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(event) =>
                update(
                  'priority',
                  event.target.value as CommerceFulfillmentPriority,
                )
              }
            >
              {COMMERCE_FULFILLMENT_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned To">
            <Select
              value={form.assignedTo}
              onChange={(event) => update('assignedTo', event.target.value)}
            >
              <option value="">Unassigned</option>
              {assignmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>
      <Section title="Status">
        <Field label="Fulfillment Status">
          <Select
            value={form.status}
            onChange={(event) =>
              update('status', event.target.value as CommerceFulfillmentStatus)
            }
          >
            {COMMERCE_FULFILLMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </Section>
      <Section title="Shipping & Tracking">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Shipping Method">
            <Input
              value={form.shippingMethod}
              onChange={(event) => update('shippingMethod', event.target.value)}
              placeholder="Ground, pickup, courier..."
            />
          </Field>
          <Field label="Carrier">
            <Input
              value={form.carrier}
              onChange={(event) => update('carrier', event.target.value)}
              placeholder="UPS, FedEx, local courier..."
            />
          </Field>
          <Field label="Tracking Number">
            <Input
              value={form.trackingNumber}
              onChange={(event) => update('trackingNumber', event.target.value)}
              placeholder="Tracking number"
            />
          </Field>
          <Field label="Estimated Delivery">
            <Input
              type="date"
              value={form.estimatedDelivery}
              onChange={(event) =>
                update('estimatedDelivery', event.target.value)
              }
            />
          </Field>
          <Field label="Shipped Date">
            <Input
              type="date"
              value={form.shippedAt}
              onChange={(event) => update('shippedAt', event.target.value)}
            />
          </Field>
          <Field label="Delivered Date">
            <Input
              type="date"
              value={form.deliveredAt}
              onChange={(event) => update('deliveredAt', event.target.value)}
            />
          </Field>
        </div>
      </Section>
      <Section title="Notes">
        <Field label="Internal Fulfillment Notes">
          <textarea
            value={form.internalNotes}
            onChange={(event) => update('internalNotes', event.target.value)}
            placeholder="Picking notes, packing requirements, carrier handoff details..."
            className="text-neutral-text-primary focus:border-brand-primary/70 focus:ring-brand-primary/60 min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm outline-none transition focus:ring-1"
          />
        </Field>
      </Section>
      {errors.fulfillment ? (
        <p className="text-xs text-rose-300">{errors.fulfillment}</p>
      ) : null}
    </div>
  )
}

function QuickStatusCard({
  label,
  value,
  variant,
  options,
  open,
  disabled,
  onOpenChange,
  onSelect,
}: {
  label: string
  value: string
  variant: BadgeVariant
  options: readonly FulfillmentStatusOption[]
  open: boolean
  disabled?: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (option: FulfillmentStatusOption) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const currentOption = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node))
        onOpenChange(false)
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
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className={cn(
          'w-full rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60',
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/35 p-4">
      <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-neutral-text-secondary text-xs font-medium">
        {label}
        {required ? <span className="text-cyan-300"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

function DescriptionRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/60 pb-2 last:border-b-0 last:pb-0">
      <p className="text-neutral-text-secondary text-xs">{label}</p>
      <div className="max-w-[70%] text-right text-sm font-medium text-neutral-100">
        {value}
      </div>
    </div>
  )
}

function RelatedRecordButton({
  label,
  title,
  description,
  href,
  disabled,
  onClick,
}: {
  label: string
  title: string
  description: string
  href?: string
  disabled?: boolean
  onClick?: () => void
}) {
  const interactive = !disabled && (Boolean(onClick) || Boolean(href))
  const content = (
    <>
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
      {interactive ? (
        <ChevronDown className="h-4 w-4 -rotate-90 text-cyan-200/80" />
      ) : null}
    </>
  )
  const className = cn(
    'flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
    interactive
      ? 'cursor-pointer hover:border-cyan-300/30 hover:bg-cyan-300/[0.04]'
      : 'cursor-default',
  )

  if (href && !disabled) {
    return (
      <a
        href={href}
        onKeyDown={(event) => {
          if (event.key === ' ') {
            event.preventDefault()
            event.currentTarget.click()
          }
        }}
        className={className}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  )
}

function AddressDisplay({
  title,
  address,
}: {
  title: string
  address?: CommerceAddress
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
        {title}
      </h4>
      <AddressLines className="mt-2" address={address} />
    </div>
  )
}

function AddressLines({
  address,
  className,
}: {
  address?: CommerceAddress
  className?: string
}) {
  if (!address) {
    return (
      <p className={cn('text-neutral-text-secondary text-sm', className)}>
        Not set
      </p>
    )
  }
  const lines = [
    address.name,
    address.company,
    address.line1,
    address.line2,
    [address.city, address.region, address.postalCode]
      .filter(Boolean)
      .join(', '),
    address.country,
    address.phone,
  ].filter(Boolean)
  return (
    <div className={cn('space-y-0.5 text-sm text-neutral-200', className)}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  )
}
