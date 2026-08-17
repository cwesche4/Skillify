'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  ChevronDown,
  Check,
  Download,
  Edit3,
  Plus,
  Search,
  Tags,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'

import { BulkActionDialog } from '@/components/bulk/BulkActionDialog'
import {
  BulkActionToolbar,
  type BulkToolbarAction,
} from '@/components/bulk/BulkActionToolbar'
import {
  BulkSelectionCheckbox,
  HeaderBulkSelectionCheckbox,
} from '@/components/bulk/BulkSelectionCheckbox'
import { useBulkSelection } from '@/components/bulk/useBulkSelection'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClearFiltersButton } from '@/components/ui/ClearFiltersButton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { Textarea } from '@/components/ui/Textarea'
import {
  COMMERCE_CUSTOMER_STATUS_OPTIONS,
  getCommerceStatusLabel,
} from '@/lib/commerce/commerceRegistry'
import {
  buildCustomerRecord,
  getCustomerCountryOptions,
  getCustomerTagOptions,
  getCustomerTypeOptions,
  selectCustomerCounts,
  selectCustomerRecords,
  type CustomerRecord,
  type CustomerSortKey,
  type CustomerTypeFilter,
  type CustomerViewKey,
} from '@/lib/commerce/customerCatalog'
import {
  getCustomerDisplayTags,
  getCustomerTagUsageMap,
  normalizeCustomerTagLabel,
  validateCustomerTagLabel,
} from '@/lib/commerce/customerTagRegistry'
import {
  getCustomerTypeLabel,
  getCustomerTypeUsageMap,
} from '@/lib/commerce/customerTypeRegistry'
import {
  archivePreviewCustomer,
  migratePreviewCustomerTypes,
  migratePreviewCustomerTags,
  commercePreviewCustomersChangedEvent,
  commercePreviewFulfillmentsChangedEvent,
  commercePreviewOrdersChangedEvent,
  commercePreviewProductsChangedEvent,
  createPreviewCustomer,
  deletePreviewCustomer,
  getPreviewCustomerActivities,
  getPreviewCustomers,
  getPreviewFulfillments,
  getPreviewOrders,
  getPreviewProducts,
  updatePreviewCustomer,
} from '@/lib/commerce/previewCommerceStorage'
import {
  archivePreviewCustomerTag,
  commercePreviewCustomerTagsChangedEvent,
  createPreviewCustomerTag,
  deleteUnusedPreviewCustomerTag,
  getPreviewCustomerTags,
  renamePreviewCustomerTag,
  restorePreviewCustomerTag,
} from '@/lib/commerce/previewCommerceTagStorage'
import {
  archivePreviewCustomerType,
  commercePreviewCustomerTypesChangedEvent,
  createPreviewCustomerType,
  deleteUnusedPreviewCustomerType,
  getPreviewCustomerTypes,
  renamePreviewCustomerType,
  reorderPreviewCustomerType,
  restorePreviewCustomerType,
} from '@/lib/commerce/previewCommerceCustomerTypeStorage'
import {
  executeCommerceCustomerBulkAction,
  type CommerceCustomerBulkInput,
} from '@/lib/commerce/customerBulkActions'
import { useClearFilters } from '@/hooks/useClearFilters'
import type { BulkActionResult } from '@/lib/bulk/bulkActions'
import type {
  CommerceAddress,
  CommerceActivity,
  CommerceCustomer,
  CommerceCustomerStatus,
  CommerceCustomerTag,
  CommerceCustomerTypeDefinition,
  CommerceFulfillment,
  CommerceOrder,
  CommerceProduct,
} from '@/lib/commerce/types'
import { formatCommerceAddressLines } from '@/lib/commerce/orderCatalog'
import { formatCommerceMoney } from '@/lib/commerce/productPricing'
import { cn } from '@/lib/utils'

type Props = {
  workspaceId: string
  canEdit?: boolean
}

type CustomerFormState = {
  displayName: string
  companyName: string
  email: string
  phone: string
  lifecycleStatus: CommerceCustomerStatus
  customerTypeId: string
  tags: string[]
  billingLine1: string
  billingLine2: string
  billingCity: string
  billingRegion: string
  billingPostalCode: string
  billingCountry: string
  shippingLine1: string
  shippingLine2: string
  shippingCity: string
  shippingRegion: string
  shippingPostalCode: string
  shippingCountry: string
  defaultShippingAddress: 'BILLING' | 'SHIPPING'
  clientNotes: string
  internalNotes: string
}

const CUSTOMER_OVERLAY_TOP_OFFSET = 'var(--dashboard-top-bar-height, 3.5rem)'

const customerStatusVariant: Record<CommerceCustomerStatus, BadgeVariant> = {
  NEW: 'blue',
  ACTIVE: 'green',
  AT_RISK: 'yellow',
  INACTIVE: 'slate',
}

const summaryViews: Array<{
  view: CustomerViewKey
  label: string
  valueKey: keyof ReturnType<typeof selectCustomerCounts>
  ariaLabel: string
  format?: 'currency'
}> = [
  {
    view: 'all',
    label: 'Total Customers',
    valueKey: 'all',
    ariaLabel: 'Show all customers',
  },
  {
    view: 'new',
    label: 'New This Month',
    valueKey: 'new',
    ariaLabel: 'Show new customers',
  },
  {
    view: 'returning',
    label: 'Returning Customers',
    valueKey: 'returning',
    ariaLabel: 'Show returning customers',
  },
  {
    view: 'highValue',
    label: 'Lifetime Revenue',
    valueKey: 'lifetimeRevenue',
    ariaLabel: 'Show high lifetime value customers',
    format: 'currency',
  },
]

const viewTabs: Array<{ id: CustomerViewKey; label: string }> = [
  { id: 'all', label: 'All Customers' },
  { id: 'new', label: 'New' },
  { id: 'returning', label: 'Returning' },
  { id: 'vip', label: 'VIP' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'highValue', label: 'High Lifetime Value' },
]

function getCustomerStatusForView(
  view: CustomerViewKey,
): 'ALL' | CommerceCustomerStatus {
  if (view === 'new') return 'NEW'
  if (view === 'inactive') return 'INACTIVE'
  return 'ALL'
}

const sortOptions: Array<{ value: CustomerSortKey; label: string }> = [
  { value: 'updated-desc', label: 'Recently updated' },
  { value: 'created-desc', label: 'Newest customers' },
  { value: 'last-purchase-desc', label: 'Last purchase' },
  { value: 'lifetime-desc', label: 'Lifetime spend' },
  { value: 'name-asc', label: 'Name A-Z' },
]

const tableColumns = [
  'Customer',
  'Email',
  'Phone',
  'Orders',
  'Lifetime Spend',
  'Average Order',
  'Last Purchase',
  'Status',
  'Created',
  'Updated',
]

function formatCurrency(amount: number | undefined, currency = 'USD') {
  return formatCommerceMoney({ amount: amount ?? 0, currency })
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function clean(value: string) {
  const trimmed = value.trim()
  return trimmed || undefined
}

function addressFromFields({
  line1,
  line2,
  city,
  region,
  postalCode,
  country,
}: {
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  country: string
}): CommerceAddress | undefined {
  if (
    ![line1, line2, city, region, postalCode, country].some((value) =>
      value.trim(),
    )
  ) {
    return undefined
  }
  return {
    line1: line1.trim(),
    line2: clean(line2),
    city: city.trim(),
    region: clean(region),
    postalCode: postalCode.trim(),
    country: country.trim(),
  }
}

function normalizeErrors(errors: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(errors).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  )
}

function customerToForm(customer?: CommerceCustomer | null): CustomerFormState {
  return {
    displayName: customer?.displayName ?? '',
    companyName: customer?.companyName ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    lifecycleStatus: customer?.lifecycleStatus ?? 'NEW',
    customerTypeId: customer?.customerTypeId ?? '',
    tags: customer?.tags ?? [],
    billingLine1: customer?.billingAddress?.line1 ?? '',
    billingLine2: customer?.billingAddress?.line2 ?? '',
    billingCity: customer?.billingAddress?.city ?? '',
    billingRegion: customer?.billingAddress?.region ?? '',
    billingPostalCode: customer?.billingAddress?.postalCode ?? '',
    billingCountry: customer?.billingAddress?.country ?? '',
    shippingLine1: customer?.shippingAddress?.line1 ?? '',
    shippingLine2: customer?.shippingAddress?.line2 ?? '',
    shippingCity: customer?.shippingAddress?.city ?? '',
    shippingRegion: customer?.shippingAddress?.region ?? '',
    shippingPostalCode: customer?.shippingAddress?.postalCode ?? '',
    shippingCountry: customer?.shippingAddress?.country ?? '',
    defaultShippingAddress: customer?.defaultShippingAddress ?? 'SHIPPING',
    clientNotes: customer?.clientNotes ?? '',
    internalNotes: customer?.internalNotes ?? '',
  }
}

function formToCustomerInput(
  form: CustomerFormState,
): Partial<CommerceCustomer> {
  return {
    displayName: form.displayName,
    companyName: clean(form.companyName),
    email: clean(form.email),
    phone: clean(form.phone),
    lifecycleStatus: form.lifecycleStatus,
    customerTypeId: form.customerTypeId || undefined,
    tags: form.tags,
    billingAddress: addressFromFields({
      line1: form.billingLine1,
      line2: form.billingLine2,
      city: form.billingCity,
      region: form.billingRegion,
      postalCode: form.billingPostalCode,
      country: form.billingCountry,
    }),
    shippingAddress: addressFromFields({
      line1: form.shippingLine1,
      line2: form.shippingLine2,
      city: form.shippingCity,
      region: form.shippingRegion,
      postalCode: form.shippingPostalCode,
      country: form.shippingCountry,
    }),
    defaultShippingAddress: form.defaultShippingAddress,
    clientNotes: clean(form.clientNotes),
    internalNotes: clean(form.internalNotes),
  }
}

function getCommerceRecordHref(
  section: 'orders' | 'fulfillment' | 'products',
  paramName: 'orderId' | 'fulfillmentId' | 'productId' | 'customerId',
  recordId: string | undefined | null,
) {
  const id = recordId?.trim()
  if (!id || typeof window === 'undefined') return undefined
  const dashboardMatch = window.location.pathname.match(/^\/dashboard\/[^/]+/)
  const dashboardBase = dashboardMatch?.[0] ?? '/dashboard'
  const params = new URLSearchParams({ [paramName]: id })
  return `${dashboardBase}/${section}?${params.toString()}`
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

function CustomerTagFilterDropdown({
  value,
  tags,
  customers,
  onChange,
  onManageTags,
}: {
  value: string
  tags: CommerceCustomerTag[]
  customers: CommerceCustomer[]
  onChange: (value: string) => void
  onManageTags: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const usage = useMemo(
    () => getCustomerTagUsageMap(tags, customers),
    [customers, tags],
  )
  const activeTags = useMemo(
    () =>
      tags
        .filter((tag) => tag.status === 'active')
        .sort((first, second) => first.label.localeCompare(second.label)),
    [tags],
  )
  const selectedTag = tags.find((tag) => tag.id === value)
  const selectedLabel =
    value === 'ALL' ? 'All tags' : (selectedTag?.label ?? 'All tags')

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const selectTag = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative min-w-[11rem]">
      <button
        type="button"
        aria-label="Filter by tags"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="text-neutral-text-primary focus-visible:border-brand-primary/70 focus-visible:ring-brand-primary/50 flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-left text-sm shadow-sm outline-none transition-colors hover:border-cyan-300/35 hover:bg-cyan-300/[0.04] focus-visible:ring-2"
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown className="text-neutral-text-secondary h-4 w-4 shrink-0" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Filter by tags"
          className="absolute left-0 z-50 mt-2 w-full min-w-72 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        >
          <div className="max-h-64 overflow-y-auto p-2">
            <button
              type="button"
              role="option"
              aria-selected={value === 'ALL'}
              onClick={() => selectTag('ALL')}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
                value === 'ALL'
                  ? 'bg-cyan-300/10 text-cyan-100'
                  : 'text-neutral-200 hover:bg-slate-900 hover:text-white',
              )}
            >
              <span>All tags</span>
              {value === 'ALL' ? <Check className="h-4 w-4" /> : null}
            </button>
            {activeTags.length ? (
              activeTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  role="option"
                  aria-selected={value === tag.id}
                  onClick={() => selectTag(tag.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
                    value === tag.id
                      ? 'bg-cyan-300/10 text-cyan-100'
                      : 'text-neutral-200 hover:bg-slate-900 hover:text-white',
                  )}
                >
                  <span className="min-w-0 truncate">
                    {tag.label}
                    <span className="text-neutral-text-secondary ml-2 text-xs">
                      {usage.get(tag.id) ?? 0}
                    </span>
                  </span>
                  {value === tag.id ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : null}
                </button>
              ))
            ) : (
              <p className="text-neutral-text-secondary px-3 py-2 text-sm">
                No tags created
              </p>
            )}
          </div>
          <div className="border-t border-slate-800 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onManageTags()
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-neutral-200 transition hover:bg-slate-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              <Tags className="h-4 w-4" />
              Manage tags
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function CommerceCustomersPage({ workspaceId, canEdit = true }: Props) {
  const [customers, setCustomers] = useState<CommerceCustomer[]>([])
  const [orders, setOrders] = useState<CommerceOrder[]>([])
  const [fulfillments, setFulfillments] = useState<CommerceFulfillment[]>([])
  const [products, setProducts] = useState<CommerceProduct[]>([])
  const [customerTags, setCustomerTags] = useState<CommerceCustomerTag[]>([])
  const [customerTypes, setCustomerTypes] = useState<
    CommerceCustomerTypeDefinition[]
  >([])
  const [view, setView] = useState<CustomerViewKey>('all')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | CommerceCustomerStatus>('ALL')
  const [customerType, setCustomerType] = useState<CustomerTypeFilter>('ALL')
  const [tag, setTag] = useState('ALL')
  const [country, setCountry] = useState('ALL')
  const [sort, setSort] = useState<CustomerSortKey>('updated-desc')
  const expectedStatusForView = getCustomerStatusForView(view)
  const clearSecondaryFilters = () => {
    setQuery('')
    setStatus(expectedStatusForView)
    setCustomerType('ALL')
    setTag('ALL')
    setCountry('ALL')
  }
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      query,
      status: status === expectedStatusForView ? '' : status,
      customerType: customerType === 'ALL' ? '' : customerType,
      tag: tag === 'ALL' ? '' : tag,
      country: country === 'ALL' ? '' : country,
    },
    onClear: clearSecondaryFilters,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  )
  const [bulkActionId, setBulkActionId] = useState<string | null>(null)
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([])
  const [bulkRemoveTagIds, setBulkRemoveTagIds] = useState<string[]>([])
  const [bulkCustomerTypeId, setBulkCustomerTypeId] = useState('')
  const [bulkStatus, setBulkStatus] = useState<CommerceCustomerStatus>('ACTIVE')
  const [bulkResult, setBulkResult] = useState<BulkActionResult | null>(null)

  const reload = useCallback(() => {
    const migratedTags = migratePreviewCustomerTags({ workspaceId })
    const migratedTypes = migratePreviewCustomerTypes({ workspaceId })
    setCustomers(
      migratedTypes.customers.length
        ? migratedTypes.customers
        : migratedTags.customers,
    )
    setCustomerTags(getPreviewCustomerTags(workspaceId))
    setCustomerTypes(getPreviewCustomerTypes(workspaceId))
    setOrders(getPreviewOrders(workspaceId))
    setFulfillments(getPreviewFulfillments(workspaceId))
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
    window.addEventListener(commercePreviewCustomersChangedEvent, onChanged)
    window.addEventListener(commercePreviewCustomerTagsChangedEvent, onChanged)
    window.addEventListener(commercePreviewCustomerTypesChangedEvent, onChanged)
    window.addEventListener(commercePreviewOrdersChangedEvent, onChanged)
    window.addEventListener(commercePreviewFulfillmentsChangedEvent, onChanged)
    window.addEventListener(commercePreviewProductsChangedEvent, onChanged)
    window.addEventListener('storage', onChanged)
    return () => {
      window.removeEventListener(
        commercePreviewCustomersChangedEvent,
        onChanged,
      )
      window.removeEventListener(
        commercePreviewCustomerTagsChangedEvent,
        onChanged,
      )
      window.removeEventListener(
        commercePreviewCustomerTypesChangedEvent,
        onChanged,
      )
      window.removeEventListener(commercePreviewOrdersChangedEvent, onChanged)
      window.removeEventListener(
        commercePreviewFulfillmentsChangedEvent,
        onChanged,
      )
      window.removeEventListener(commercePreviewProductsChangedEvent, onChanged)
      window.removeEventListener('storage', onChanged)
    }
  }, [reload, workspaceId])

  const counts = useMemo(
    () =>
      selectCustomerCounts({
        customers,
        orders,
        fulfillments,
        products,
        customerTags,
      }),
    [customers, customerTags, fulfillments, orders, products],
  )
  const rows = useMemo(
    () =>
      selectCustomerRecords({
        customers,
        orders,
        fulfillments,
        products,
        customerTags,
        customerTypes,
        filters: {
          view,
          query,
          status,
          customerType,
          tag,
          country,
          sort,
        },
      }),
    [
      country,
      customerType,
      customers,
      customerTags,
      customerTypes,
      fulfillments,
      orders,
      products,
      query,
      sort,
      status,
      tag,
      view,
    ],
  )
  const selectedCustomer = selectedCustomerId
    ? (customers.find((customer) => customer.id === selectedCustomerId) ?? null)
    : null
  const visibleCustomerIds = useMemo(
    () => rows.map((record) => record.customer.id),
    [rows],
  )
  const bulkSelection = useBulkSelection({
    workspaceId,
    visibleIds: visibleCustomerIds,
    validIds: visibleCustomerIds,
  })
  const bulkSelectedCustomers = useMemo(() => {
    const selected = new Set(bulkSelection.selectedIds)
    return customers.filter((customer) => selected.has(customer.id))
  }, [bulkSelection.selectedIds, customers])
  const tags = useMemo(
    () => getCustomerTagOptions(customerTags),
    [customerTags],
  )
  const typeOptions = useMemo(
    () => getCustomerTypeOptions(customerTypes, customers),
    [customerTypes, customers],
  )
  const removableBulkTags = useMemo(() => {
    const selectedTagIds = new Set(
      bulkSelectedCustomers.flatMap((customer) => customer.tags ?? []),
    )
    return customerTags
      .filter((tag) => selectedTagIds.has(tag.id))
      .sort((first, second) => first.label.localeCompare(second.label))
  }, [bulkSelectedCustomers, customerTags])
  const countries = useMemo(
    () => getCustomerCountryOptions(customers),
    [customers],
  )

  const openBulkAction = (actionId: string) => {
    setBulkActionId(actionId)
    setBulkResult(null)
    setBulkTagIds([])
    setBulkRemoveTagIds([])
    setBulkCustomerTypeId('')
    setBulkStatus('ACTIVE')
  }

  const closeBulkAction = () => {
    setBulkActionId(null)
    setBulkResult(null)
  }

  const executeBulk = (input: CommerceCustomerBulkInput) => {
    if (!bulkActionId) return
    const result = executeCommerceCustomerBulkAction({
      workspaceId,
      actionId: bulkActionId,
      customers,
      selectedIds: bulkSelection.selectedIds,
      input,
    })
    setBulkResult(result)
    reload()
    if (result.failed === 0) bulkSelection.clear()
  }

  const primaryBulkActions: BulkToolbarAction[] = [
    {
      id: 'add-tags',
      label: 'Add Tags',
      variant: 'primary',
      icon: <Tags className="h-4 w-4" />,
      onClick: () => openBulkAction('commerce.customer.tags.add'),
    },
    {
      id: 'change-type',
      label: 'Change Type',
      onClick: () => openBulkAction('commerce.customer.type.change'),
    },
    {
      id: 'archive',
      label: 'Archive',
      destructive: true,
      icon: <Archive className="h-4 w-4" />,
      onClick: () => openBulkAction('commerce.customer.archive'),
    },
  ]
  const secondaryBulkActions: BulkToolbarAction[] = [
    {
      id: 'remove-tags',
      label: 'Remove Tags',
      disabled: removableBulkTags.length === 0,
      onClick: () => openBulkAction('commerce.customer.tags.remove'),
    },
    {
      id: 'change-status',
      label: 'Change Status',
      onClick: () => openBulkAction('commerce.customer.status.change'),
    },
    {
      id: 'export',
      label: 'Export',
      icon: <Download className="h-4 w-4" />,
      onClick: () => openBulkAction('commerce.customer.export'),
    },
  ]

  const applyView = (nextView: CustomerViewKey) => {
    setView(nextView)
    setQuery('')
    setStatus(getCustomerStatusForView(nextView))
    setCustomerType('ALL')
    setTag('ALL')
    setCountry('ALL')
  }

  const applyStatus = (nextStatus: 'ALL' | CommerceCustomerStatus) => {
    setStatus(nextStatus)
  }

  return (
    <main className="bg-app-background text-app-primary min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300/80">
              Product & Commerce
            </p>
            <h1 className="text-app-primary mt-2 text-2xl font-semibold">
              Customers
            </h1>
            <p className="text-app-secondary mt-1 max-w-2xl text-sm">
              Manage buyer relationships, purchasing history, commerce notes,
              and preview-safe customer activity.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!canEdit}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create Customer
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {summaryViews.map((item) => (
            <button
              key={item.view}
              type="button"
              aria-label={item.ariaLabel}
              aria-pressed={view === item.view}
              onClick={() => applyView(item.view)}
              className={cn(
                'metric-card-surface rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                'hover:border-cyan-500/35 hover:bg-cyan-50 dark:hover:border-cyan-300/35 dark:hover:bg-cyan-300/[0.05]',
                view === item.view &&
                  'border-cyan-500/45 bg-cyan-50 dark:border-cyan-300/55 dark:bg-cyan-300/[0.08]',
              )}
            >
              <p className="text-metric-muted text-xs font-medium">
                {item.label}
              </p>
              <p className="text-metric mt-2 text-2xl font-semibold">
                {item.format === 'currency'
                  ? formatCurrency(Number(counts[item.valueKey]))
                  : counts[item.valueKey]}
              </p>
            </button>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="border-app border-b p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {viewTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => applyView(tab.id)}
                    aria-pressed={view === tab.id}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      view === tab.id
                        ? 'border-cyan-500/45 bg-cyan-500/10 text-cyan-700 dark:border-cyan-300/60 dark:bg-cyan-300/10 dark:text-cyan-100'
                        : 'border-app bg-app-surface-raised text-app-secondary hover:bg-app-surface-hover hover:text-app-primary hover:border-cyan-500/35 dark:border-slate-700 dark:bg-slate-950/50 dark:text-neutral-300 dark:hover:border-slate-500 dark:hover:text-white',
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

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_minmax(7.5rem,auto)]">
              <label className="relative">
                <Search className="text-neutral-text-secondary pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search customer, email, phone, company, tags..."
                  className="pl-9"
                  aria-label="Search customers"
                />
              </label>
              <Select
                value={status}
                onChange={(event) =>
                  applyStatus(
                    event.target.value as 'ALL' | CommerceCustomerStatus,
                  )
                }
                aria-label="Filter by status"
              >
                <option value="ALL">All statuses</option>
                {COMMERCE_CUSTOMER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select
                value={customerType}
                onChange={(event) =>
                  setCustomerType(event.target.value as CustomerTypeFilter)
                }
                aria-label="Filter by customer type"
              >
                <option value="ALL">All types</option>
                {typeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.isArchived ? ' (Archived)' : ''}
                  </option>
                ))}
              </Select>
              <CustomerTagFilterDropdown
                value={tag}
                tags={customerTags}
                customers={customers}
                onChange={setTag}
                onManageTags={() => setTagManagerOpen(true)}
              />
              <Select
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                aria-label="Filter by country"
              >
                <option value="ALL">All countries</option>
                {countries.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as CustomerSortKey)
                }
                aria-label="Sort customers"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {customers.length === 0 ? (
            <div className="p-10 text-center">
              <UserRound className="mx-auto h-10 w-10 text-cyan-300/70" />
              <h2 className="text-app-primary mt-3 text-base font-semibold">
                No commerce customers yet.
              </h2>
              <p className="text-app-secondary mt-1 text-sm">
                Create a customer or add one inline while creating an order.
              </p>
              <Button
                type="button"
                className="mt-4"
                onClick={() => setCreateOpen(true)}
                disabled={!canEdit}
              >
                Create Customer
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-app-primary text-sm font-semibold">
                No customers match this view.
              </p>
              <p className="text-app-secondary mt-1 text-sm">
                Adjust search, status, type, tags, country, or sort filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <BulkActionToolbar
                selectedCount={bulkSelection.selectedCount}
                recordLabel="customer"
                primaryActions={primaryBulkActions}
                secondaryActions={secondaryBulkActions}
                allVisibleSelected={
                  bulkSelection.headerState === 'checked' &&
                  visibleCustomerIds.length > 0
                }
                allMatchingSelected={bulkSelection.allMatchingSelected}
                visibleCount={visibleCustomerIds.length}
                matchingCount={rows.length}
                selectAllMatchingSupported
                onSelectAllMatching={bulkSelection.selectAllMatching}
                onClear={bulkSelection.clear}
                className="mx-4 mt-4"
              />
              <Table className="min-w-[1120px]">
                <THead>
                  <TR>
                    <TH className="w-10">
                      <HeaderBulkSelectionCheckbox
                        state={bulkSelection.headerState}
                        onChange={bulkSelection.toggleVisible}
                      />
                    </TH>
                    {tableColumns.map((column) => (
                      <TH key={column}>{column}</TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {rows.map((record) => (
                    <TR
                      key={record.customer.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open customer ${record.customer.displayName}`}
                      className="cursor-pointer"
                      onClick={(event) => {
                        if (
                          isInteractiveRowTarget(
                            event.target,
                            event.currentTarget,
                          )
                        )
                          return
                        setSelectedCustomerId(record.customer.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedCustomerId(record.customer.id)
                        }
                      }}
                    >
                      <TD className="w-10">
                        <BulkSelectionCheckbox
                          checked={bulkSelection.selectedIdSet.has(
                            record.customer.id,
                          )}
                          label={`Select customer ${record.customer.displayName}`}
                          onChange={(checked, event) => {
                            bulkSelection.toggleOne({
                              id: record.customer.id,
                              checked,
                              range:
                                event.nativeEvent instanceof MouseEvent
                                  ? event.nativeEvent.shiftKey
                                  : false,
                            })
                          }}
                        />
                      </TD>
                      <TD>
                        <div className="min-w-0">
                          <p className="text-app-primary font-medium">
                            {record.customer.displayName}
                          </p>
                          {record.customer.companyName ? (
                            <p className="text-app-secondary mt-0.5 text-xs">
                              {record.customer.companyName}
                            </p>
                          ) : null}
                        </div>
                      </TD>
                      <TD>{record.customer.email ?? 'Not set'}</TD>
                      <TD>{record.customer.phone ?? 'Not set'}</TD>
                      <TD>{record.metrics.totalOrders}</TD>
                      <TD>{formatCurrency(record.metrics.lifetimeRevenue)}</TD>
                      <TD>
                        {formatCurrency(record.metrics.averageOrderValue)}
                      </TD>
                      <TD>{formatDate(record.metrics.lastPurchase)}</TD>
                      <TD>
                        <Badge
                          variant={
                            customerStatusVariant[
                              record.customer.lifecycleStatus
                            ]
                          }
                        >
                          {getCommerceStatusLabel(
                            record.customer.lifecycleStatus,
                          )}
                        </Badge>
                      </TD>
                      <TD>{formatDate(record.customer.createdAt)}</TD>
                      <TD>{formatDate(record.customer.updatedAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {tagManagerOpen ? (
        <CustomerTagManagerModal
          workspaceId={workspaceId}
          customers={customers}
          tags={customerTags}
          onClose={() => setTagManagerOpen(false)}
          onRegistryChanged={reload}
        />
      ) : null}

      {createOpen ? (
        <CustomerModal
          title="Create Customer"
          workspaceId={workspaceId}
          customers={customers}
          customerTags={customerTags}
          customerTypes={customerTypes}
          onTagsChanged={reload}
          onTypesChanged={reload}
          onClose={() => setCreateOpen(false)}
          onSaved={(customerId) => {
            reload()
            setCreateOpen(false)
            setSelectedCustomerId(customerId)
          }}
        />
      ) : null}

      {selectedCustomer ? (
        <CustomerDrawer
          workspaceId={workspaceId}
          customer={selectedCustomer}
          orders={orders}
          fulfillments={fulfillments}
          products={products}
          customerTags={customerTags}
          customerTypes={customerTypes}
          canEdit={canEdit}
          onClose={() => setSelectedCustomerId(null)}
          onReload={reload}
          onSelectCustomer={setSelectedCustomerId}
        />
      ) : null}

      {bulkActionId ? (
        <CustomerBulkActionDialog
          actionId={bulkActionId}
          workspaceId={workspaceId}
          selectedCount={bulkSelection.selectedCount}
          selectedCustomers={bulkSelectedCustomers}
          customerTags={customerTags}
          tagIds={bulkTagIds}
          onTagIdsChange={setBulkTagIds}
          onTagsChanged={reload}
          removableTags={removableBulkTags}
          removeTagIds={bulkRemoveTagIds}
          onRemoveTagIdsChange={setBulkRemoveTagIds}
          typeOptions={typeOptions}
          customerTypeId={bulkCustomerTypeId}
          onCustomerTypeIdChange={setBulkCustomerTypeId}
          status={bulkStatus}
          onStatusChange={setBulkStatus}
          result={bulkResult}
          onConfirm={executeBulk}
          onClose={closeBulkAction}
        />
      ) : null}
    </main>
  )
}

function CustomerBulkActionDialog({
  actionId,
  workspaceId,
  selectedCount,
  selectedCustomers,
  customerTags,
  tagIds,
  onTagIdsChange,
  onTagsChanged,
  removableTags,
  removeTagIds,
  onRemoveTagIdsChange,
  typeOptions,
  customerTypeId,
  onCustomerTypeIdChange,
  status,
  onStatusChange,
  result,
  onConfirm,
  onClose,
}: {
  actionId: string
  workspaceId: string
  selectedCount: number
  selectedCustomers: CommerceCustomer[]
  customerTags: CommerceCustomerTag[]
  tagIds: string[]
  onTagIdsChange: (value: string[]) => void
  onTagsChanged: () => void
  removableTags: CommerceCustomerTag[]
  removeTagIds: string[]
  onRemoveTagIdsChange: (value: string[]) => void
  typeOptions: CommerceCustomerTypeDefinition[]
  customerTypeId: string
  onCustomerTypeIdChange: (value: string) => void
  status: CommerceCustomerStatus
  onStatusChange: (value: CommerceCustomerStatus) => void
  result: BulkActionResult | null
  onConfirm: (input: CommerceCustomerBulkInput) => void
  onClose: () => void
}) {
  const selectedCopy = `${selectedCount} selected customer${selectedCount === 1 ? '' : 's'}`

  if (actionId === 'commerce.customer.tags.add') {
    return (
      <BulkActionDialog
        title="Add tags"
        description="Add one or more workspace tags to the selected customer(s). Existing customer tags will be preserved."
        confirmLabel="Add Tags"
        disabled={tagIds.length === 0}
        result={result}
        onClose={onClose}
        onConfirm={() => onConfirm({ kind: 'tag-add', tagIds })}
      >
        <p className="text-xs font-medium text-neutral-300">{selectedCopy}</p>
        <BulkCustomerTagPicker
          workspaceId={workspaceId}
          customers={selectedCustomers}
          tags={customerTags}
          selectedTagIds={tagIds}
          onChange={onTagIdsChange}
          onRegistryChanged={onTagsChanged}
        />
        <p className="text-neutral-text-secondary text-xs">
          Archived tags can be restored from Manage Tags.
        </p>
      </BulkActionDialog>
    )
  }

  if (actionId === 'commerce.customer.tags.remove') {
    return (
      <BulkActionDialog
        title="Remove tags"
        description={`Remove selected tags from ${selectedCopy}. Tag definitions stay in the workspace registry.`}
        confirmLabel="Remove Tags"
        disabled={removeTagIds.length === 0}
        result={result}
        onClose={onClose}
        onConfirm={() =>
          onConfirm({ kind: 'tag-remove', tagIds: removeTagIds })
        }
      >
        {removableTags.length ? (
          <div className="space-y-2">
            {removableTags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/35 px-3 py-2 text-sm text-neutral-100"
              >
                <input
                  type="checkbox"
                  checked={removeTagIds.includes(tag.id)}
                  onChange={(event) => {
                    onRemoveTagIdsChange(
                      event.target.checked
                        ? [...removeTagIds, tag.id]
                        : removeTagIds.filter((tagId) => tagId !== tag.id),
                    )
                  }}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-300"
                />
                {tag.label}
                {tag.status === 'archived' ? (
                  <span className="text-neutral-text-secondary text-xs">
                    Archived
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-neutral-text-secondary text-sm">
            None of the selected customers have tags to remove.
          </p>
        )}
      </BulkActionDialog>
    )
  }

  if (actionId === 'commerce.customer.type.change') {
    return (
      <BulkActionDialog
        title="Change customer type"
        description={`Set one customer type for ${selectedCopy}. Customer type is classification metadata and does not change lifecycle status.`}
        confirmLabel="Change Type"
        result={result}
        onClose={onClose}
        onConfirm={() =>
          onConfirm({
            kind: 'type',
            customerTypeId: customerTypeId || undefined,
          })
        }
      >
        <Select
          value={customerTypeId}
          onChange={(event) => onCustomerTypeIdChange(event.target.value)}
          aria-label="Bulk customer type"
        >
          <option value="">Not set</option>
          {typeOptions
            .filter((type) => type.isActive)
            .map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
        </Select>
      </BulkActionDialog>
    )
  }

  if (actionId === 'commerce.customer.status.change') {
    return (
      <BulkActionDialog
        title="Change relationship status"
        description={`Set one relationship status for ${selectedCopy}. This does not modify orders, revenue, notes, or addresses.`}
        confirmLabel="Change Status"
        result={result}
        onClose={onClose}
        onConfirm={() => onConfirm({ kind: 'status', lifecycleStatus: status })}
      >
        <Select
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as CommerceCustomerStatus)
          }
          aria-label="Bulk customer status"
        >
          {COMMERCE_CUSTOMER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </BulkActionDialog>
    )
  }

  if (actionId === 'commerce.customer.archive') {
    const archiveNoun = selectedCount === 1 ? 'Customer' : 'Customers'
    const archiveSubject =
      selectedCount === 1
        ? 'the selected customer'
        : `${selectedCount} selected customers`
    const archiveVerb = selectedCount === 1 ? 'sets this customer' : 'sets them'
    return (
      <BulkActionDialog
        title={`Archive ${archiveNoun.toLowerCase()}`}
        description={`Archive ${archiveSubject}. This ${archiveVerb} inactive and does not delete orders, fulfillments, notes, or derived metrics.`}
        confirmLabel={`Archive ${archiveNoun}`}
        destructive
        result={result}
        onClose={onClose}
        onConfirm={() => onConfirm({ kind: 'archive' })}
      >
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
          Archive is reversible in future lifecycle tooling. Permanent deletion
          remains separate and protected.
        </p>
      </BulkActionDialog>
    )
  }

  return (
    <BulkActionDialog
      title="Export customers"
      description={`Prepare ${selectedCopy} for export without changing any records.`}
      confirmLabel="Prepare Export"
      result={result}
      onClose={onClose}
      onConfirm={() => onConfirm({ kind: 'export' })}
    >
      <p className="text-neutral-text-secondary text-sm">
        Export uses the selected workspace-scoped customer records only.
      </p>
    </BulkActionDialog>
  )
}

function BulkCustomerTagPicker({
  workspaceId,
  customers,
  tags,
  selectedTagIds,
  onChange,
  onRegistryChanged,
}: {
  workspaceId: string
  customers: CommerceCustomer[]
  tags: CommerceCustomerTag[]
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  onRegistryChanged: () => void
}) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const searchId = useId()
  const usage = useMemo(
    () => getCustomerTagUsageMap(tags, customers),
    [customers, tags],
  )
  const activeTags = useMemo(
    () =>
      tags
        .filter((tag) => tag.status === 'active')
        .sort((first, second) => first.label.localeCompare(second.label)),
    [tags],
  )
  const normalizedQuery = normalizeCustomerTagLabel(query)
  const filteredTags = useMemo(() => {
    if (!normalizedQuery) return activeTags
    return activeTags.filter((tag) =>
      tag.normalizedLabel.includes(normalizedQuery),
    )
  }, [activeTags, normalizedQuery])
  const selectedTags = selectedTagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is CommerceCustomerTag => Boolean(tag))
  const exactTagMatch = tags.find(
    (tag) => tag.normalizedLabel === normalizedQuery,
  )
  const createError = query.trim()
    ? validateCustomerTagLabel(query, tags)
    : undefined
  const canCreate = Boolean(normalizedQuery && !exactTagMatch && !createError)
  const archivedExactMatch = exactTagMatch?.status === 'archived'

  const setSelectedTagIds = (tagIds: string[]) => {
    onChange(Array.from(new Set(tagIds)))
  }

  const toggleTag = (tagId: string) => {
    setError('')
    setSelectedTagIds(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId],
    )
  }

  const createTag = () => {
    if (!canCreate) return
    const result = createPreviewCustomerTag({ workspaceId, label: query })
    if (!result.tag) {
      setError(result.errors.label ?? 'Tag could not be created.')
      return
    }
    onRegistryChanged()
    setSelectedTagIds([...selectedTagIds, result.tag.id])
    setQuery('')
    setError('')
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={searchId}
          className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.18em]"
        >
          Customer tags
        </label>
        <Input
          id={searchId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setError('')
          }}
          placeholder="Search active tags..."
          aria-label="Search customer tags"
          className="mt-2"
        />
      </div>

      {selectedTags.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Selected tags">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              title={tag.label}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-xs font-medium text-cyan-100"
            >
              <span className="truncate">{tag.label}</span>
              <button
                type="button"
                aria-label={`Remove ${tag.label} tag`}
                onClick={() => toggleTag(tag.id)}
                className="rounded-full p-0.5 text-cyan-100/80 transition hover:bg-cyan-300/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div
        role="listbox"
        aria-label="Active workspace tags"
        className="max-h-64 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/35 p-2"
      >
        {filteredTags.length ? (
          filteredTags.map((tag) => {
            const selected = selectedTagIds.includes(tag.id)
            const assignedCount = usage.get(tag.id) ?? 0
            const coverage =
              customers.length === 0
                ? 'No selected customers'
                : assignedCount === customers.length
                  ? 'All selected'
                  : `${assignedCount} of ${customers.length} customers`
            return (
              <button
                key={tag.id}
                type="button"
                role="option"
                aria-selected={selected}
                title={`${tag.label} · ${coverage}`}
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                  selected
                    ? 'bg-cyan-300/10 text-cyan-100'
                    : 'text-neutral-200 hover:bg-slate-950/70 hover:text-white',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {tag.label}
                  </span>
                  <span className="text-neutral-text-secondary text-xs">
                    {coverage}
                  </span>
                </span>
                {selected ? (
                  <Check
                    className="h-4 w-4 shrink-0 text-cyan-200"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            )
          })
        ) : (
          <p className="text-neutral-text-secondary px-3 py-2 text-sm">
            {activeTags.length
              ? 'No active tags match this search.'
              : 'No active tags created.'}
          </p>
        )}

        {canCreate ? (
          <button
            type="button"
            onClick={createTag}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          >
            <Plus className="h-4 w-4" />
            Create tag “{query.trim()}”
          </button>
        ) : null}

        {archivedExactMatch ? (
          <p className="px-3 py-2 text-xs text-amber-100">
            “{exactTagMatch.label}” is archived. Restore it from Manage Tags
            before assigning it.
          </p>
        ) : createError && query.trim() && !exactTagMatch ? (
          <p className="px-3 py-2 text-xs text-amber-100">{createError}</p>
        ) : null}
      </div>

      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
    </div>
  )
}

function CustomerModal({
  title,
  workspaceId,
  customers,
  customerTags,
  customerTypes,
  onTagsChanged,
  onTypesChanged,
  onClose,
  onSaved,
}: {
  title: string
  workspaceId: string
  customers: CommerceCustomer[]
  customerTags: CommerceCustomerTag[]
  customerTypes: CommerceCustomerTypeDefinition[]
  onTagsChanged: () => void
  onTypesChanged: () => void
  onClose: () => void
  onSaved: (customerId: string) => void
}) {
  const [portalReady, setPortalReady] = useState(false)
  const [form, setForm] = useState<CustomerFormState>(() => customerToForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => setPortalReady(true), [])
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = createPreviewCustomer({
      workspaceId,
      input: formToCustomerInput(form),
    })
    if (Object.keys(result.errors).length || !result.customer) {
      setErrors(normalizeErrors(result.errors))
      return
    }
    onSaved(result.customer.id)
  }

  const modal = (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      style={{ top: CUSTOMER_OVERLAY_TOP_OFFSET }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={submit}
        className="flex max-h-[calc(100dvh-var(--dashboard-top-bar-height,3.5rem)-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
              Customer
            </p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-50">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-text-secondary rounded-xl p-2 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close customer modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <CustomerForm
            workspaceId={workspaceId}
            customers={customers}
            customerTags={customerTags}
            customerTypes={customerTypes}
            form={form}
            setForm={setForm}
            errors={errors}
            onTagsChanged={onTagsChanged}
            onTypesChanged={onTypesChanged}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Customer</Button>
        </div>
      </form>
    </div>
  )

  return portalReady ? createPortal(modal, document.body) : null
}

function CustomerDrawer({
  workspaceId,
  customer,
  orders,
  fulfillments,
  products,
  customerTags,
  customerTypes,
  canEdit,
  onClose,
  onReload,
  onSelectCustomer,
}: {
  workspaceId: string
  customer: CommerceCustomer
  orders: CommerceOrder[]
  fulfillments: CommerceFulfillment[]
  products: CommerceProduct[]
  customerTags: CommerceCustomerTag[]
  customerTypes: CommerceCustomerTypeDefinition[]
  canEdit: boolean
  onClose: () => void
  onReload: () => void
  onSelectCustomer: (customerId: string | null) => void
}) {
  const [portalReady, setPortalReady] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CustomerFormState>(() =>
    customerToForm(customer),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingCustomerAction, setPendingCustomerAction] = useState<
    'archive' | 'delete' | null
  >(null)
  const [customerActionError, setCustomerActionError] = useState<string | null>(
    null,
  )
  const record = buildCustomerRecord({
    customer,
    orders,
    fulfillments,
    products,
  })
  const activities = getPreviewCustomerActivities(workspaceId, customer.id)
  useEffect(() => setPortalReady(true), [])
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (pendingCustomerAction) return
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, pendingCustomerAction])
  useEffect(() => {
    setForm(customerToForm(customer))
    setErrors({})
  }, [customer])

  function save() {
    const result = updatePreviewCustomer({
      workspaceId,
      customerId: customer.id,
      changes: formToCustomerInput(form),
    })
    if (!result.customer) {
      setErrors(normalizeErrors(result.errors))
      return
    }
    setErrors({})
    setEditing(false)
    onReload()
    onSelectCustomer(result.customer.id)
  }

  function archive() {
    archivePreviewCustomer({ workspaceId, customerId: customer.id })
    onReload()
    setPendingCustomerAction(null)
  }

  function remove() {
    deletePreviewCustomer({ workspaceId, customerId: customer.id })
    onReload()
    onSelectCustomer(null)
    setPendingCustomerAction(null)
  }

  const drawer = (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/40 backdrop-blur-sm dark:bg-slate-950/55"
      style={{ top: CUSTOMER_OVERLAY_TOP_OFFSET }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Customer ${customer.displayName}`}
        className="drawer-surface ml-auto flex h-full w-full max-w-3xl flex-col border-l shadow-2xl"
      >
        <div className="drawer-header-surface sticky top-0 z-20 border-b p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300/80">
                COMMERCE CUSTOMER
              </p>
              <h2 className="text-app-primary mt-1 truncate text-xl font-semibold">
                {customer.displayName}
              </h2>
              <div className="text-neutral-text-secondary mt-1 flex flex-wrap items-center gap-2 text-sm">
                {customer.email ? (
                  <span className="truncate">{customer.email}</span>
                ) : null}
                <Badge
                  variant={customerStatusVariant[customer.lifecycleStatus]}
                >
                  {getCommerceStatusLabel(customer.lifecycleStatus)}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {editing ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(false)
                      setForm(customerToForm(customer))
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
                  Edit Customer
                </Button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-neutral-text-secondary rounded-xl p-2 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Close customer drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {editing ? (
            <CustomerForm
              workspaceId={workspaceId}
              customers={getPreviewCustomers(workspaceId)}
              customerTags={customerTags}
              customerTypes={customerTypes}
              form={form}
              setForm={setForm}
              errors={errors}
              onTagsChanged={onReload}
              onTypesChanged={onReload}
            />
          ) : (
            <CustomerDetails
              workspaceId={workspaceId}
              customer={customer}
              record={record}
              customerTags={customerTags}
              customerTypes={customerTypes}
              activities={activities}
              canEdit={canEdit}
              onReload={onReload}
            />
          )}
          {!editing ? (
            <Section title="Actions">
              <div className="grid gap-2 sm:grid-cols-3">
                <a
                  href={getCommerceRecordHref(
                    'orders',
                    'customerId',
                    customer.id,
                  )}
                  className="text-neutral-text-primary inline-flex h-8 items-center justify-center rounded-xl border border-slate-700 px-3 text-xs font-medium transition hover:bg-slate-900/60"
                >
                  Create Order
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => {
                    setCustomerActionError(null)
                    setPendingCustomerAction('archive')
                  }}
                  leftIcon={<Archive className="h-3.5 w-3.5" />}
                >
                  Archive Customer
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => {
                    setCustomerActionError(null)
                    setPendingCustomerAction('delete')
                  }}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Delete Preview Record
                </Button>
              </div>
            </Section>
          ) : null}
        </div>
      </aside>
    </div>
  )

  return portalReady
    ? createPortal(
        <>
          {drawer}
          <ConfirmDialog
            open={pendingCustomerAction === 'archive'}
            title="Archive customer?"
            description={
              <div className="space-y-2">
                <p>
                  Archive {customer.displayName}. The customer stays in preview
                  storage and can still be found with inactive customer filters.
                </p>
                {customerActionError ? (
                  <p className="text-rose-300">{customerActionError}</p>
                ) : null}
              </div>
            }
            confirmLabel="Archive customer"
            destructive
            onOpenChange={(open) => {
              if (!open) setPendingCustomerAction(null)
            }}
            onConfirm={() => {
              try {
                archive()
              } catch {
                setCustomerActionError('Customer could not be archived.')
              }
            }}
          />
          <ConfirmDialog
            open={pendingCustomerAction === 'delete'}
            title="Delete preview customer?"
            description={
              <div className="space-y-2">
                <p>
                  Delete {customer.displayName} from this preview workspace.
                  This cannot be undone.
                </p>
                {customerActionError ? (
                  <p className="text-rose-300">{customerActionError}</p>
                ) : null}
              </div>
            }
            confirmLabel="Delete customer"
            destructive
            onOpenChange={(open) => {
              if (!open) setPendingCustomerAction(null)
            }}
            onConfirm={() => {
              try {
                remove()
              } catch {
                setCustomerActionError('Customer could not be deleted.')
              }
            }}
          />
        </>,
        document.body,
      )
    : null
}

function CustomerDetails({
  workspaceId,
  customer,
  record,
  customerTags,
  customerTypes,
  activities,
  canEdit,
  onReload,
}: {
  workspaceId: string
  customer: CommerceCustomer
  record: CustomerRecord
  customerTags: CommerceCustomerTag[]
  customerTypes: CommerceCustomerTypeDefinition[]
  activities: CommerceActivity[]
  canEdit: boolean
  onReload: () => void
}) {
  return (
    <div className="space-y-5">
      <Section title="Customer Details">
        <DescriptionRow label="Name" value={customer.displayName} />
        {customer.companyName ? (
          <DescriptionRow label="Company" value={customer.companyName} />
        ) : null}
        {customer.email ? (
          <DescriptionRow label="Email" value={customer.email} />
        ) : null}
        {customer.phone ? (
          <DescriptionRow label="Phone" value={customer.phone} />
        ) : null}
        <DescriptionRow
          label="Customer Since"
          value={formatDate(customer.createdAt)}
        />
        {customer.customerTypeId ? (
          <DescriptionRow
            label="Customer Type"
            value={
              <span>
                {getCustomerTypeLabel(customer.customerTypeId, customerTypes)}
                {customerTypes.find(
                  (type) => type.id === customer.customerTypeId,
                )?.isArchived
                  ? ' · Archived'
                  : ''}
              </span>
            }
          />
        ) : null}
        <DescriptionRow
          label="Status"
          value={
            <Badge variant={customerStatusVariant[customer.lifecycleStatus]}>
              {getCommerceStatusLabel(customer.lifecycleStatus)}
            </Badge>
          }
        />
        {getCustomerDisplayTags(customer, customerTags).length ? (
          <DescriptionRow
            label="Tags"
            value={
              <span className="flex flex-wrap justify-end gap-1">
                {getCustomerDisplayTags(customer, customerTags).map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={tag.status === 'archived' ? 'slate' : 'blue'}
                  >
                    {tag.label}
                    {tag.status === 'archived' ? ' · Archived' : ''}
                  </Badge>
                ))}
              </span>
            }
          />
        ) : null}
      </Section>
      <Section title="Addresses">
        <div className="grid gap-3 md:grid-cols-2">
          <AddressDisplay title="Billing" address={customer.billingAddress} />
          <AddressDisplay title="Shipping" address={customer.shippingAddress} />
        </div>
        <DescriptionRow
          label="Default Shipping"
          value={
            customer.defaultShippingAddress === 'BILLING'
              ? 'Billing'
              : 'Shipping'
          }
        />
      </Section>
      <Section title="Commerce Metrics">
        <div className="grid gap-2 sm:grid-cols-2">
          <MetricCard
            label="Lifetime Revenue"
            value={formatCurrency(record.metrics.lifetimeRevenue)}
          />
          <MetricCard label="Orders" value={record.metrics.totalOrders} />
          <MetricCard
            label="Average Order Value"
            value={formatCurrency(record.metrics.averageOrderValue)}
          />
          <MetricCard
            label="Largest Order"
            value={formatCurrency(record.metrics.largestOrder)}
          />
          <MetricCard
            label="Last Purchase"
            value={formatDate(record.metrics.lastPurchase)}
          />
          <MetricCard
            label="Products Purchased"
            value={record.metrics.productsPurchased}
          />
          <MetricCard label="Refunds" value={record.metrics.refunds} />
        </div>
      </Section>
      <CustomerNotesCard
        workspaceId={workspaceId}
        customer={customer}
        canEdit={canEdit}
        onReload={onReload}
      />
      <Section title="Connected Records">
        {record.orders.length ? (
          <div className="space-y-2">
            {record.orders.map((order) => (
              <RelatedRecordLink
                key={order.id}
                label="Order"
                title={order.orderNumber}
                description={`${getCommerceStatusLabel(order.status)} · ${formatCurrency(order.total, order.currency)}`}
                href={getCommerceRecordHref('orders', 'orderId', order.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-neutral-text-secondary text-sm">No orders yet.</p>
        )}
        {record.fulfillments.length ? (
          <div className="space-y-2">
            {record.fulfillments.map((fulfillment) => (
              <RelatedRecordLink
                key={fulfillment.id}
                label="Fulfillment"
                title={fulfillment.fulfillmentNumber}
                description={getCommerceStatusLabel(fulfillment.status)}
                href={getCommerceRecordHref(
                  'fulfillment',
                  'fulfillmentId',
                  fulfillment.id,
                )}
              />
            ))}
          </div>
        ) : null}
        {record.products.length ? (
          <div className="space-y-2">
            {record.products.map((product) => (
              <RelatedRecordLink
                key={product.id}
                label="Product Purchased"
                title={product.name}
                description={
                  product.sku ?? product.category ?? 'Product record'
                }
                href={getCommerceRecordHref(
                  'products',
                  'productId',
                  product.id,
                )}
              />
            ))}
          </div>
        ) : null}
        <FutureCommerceRelationships />
      </Section>
      <Section title="Timeline">
        <TimelineList
          activities={activities}
          empty="No customer activity yet."
        />
      </Section>
    </div>
  )
}

function CustomerForm({
  workspaceId,
  customers,
  customerTags,
  customerTypes,
  form,
  setForm,
  errors,
  onTagsChanged,
  onTypesChanged,
}: {
  workspaceId: string
  customers: CommerceCustomer[]
  customerTags: CommerceCustomerTag[]
  customerTypes: CommerceCustomerTypeDefinition[]
  form: CustomerFormState
  setForm: React.Dispatch<React.SetStateAction<CustomerFormState>>
  errors: Record<string, string>
  onTagsChanged: () => void
  onTypesChanged: () => void
}) {
  const update = <K extends keyof CustomerFormState>(
    key: K,
    value: CustomerFormState[K],
  ) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="space-y-5">
      <Section title="Customer Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <Input
              value={form.displayName}
              onChange={(event) => update('displayName', event.target.value)}
              placeholder="Corbin Wesche"
            />
          </Field>
          <Field label="Company">
            <Input
              value={form.companyName}
              onChange={(event) => update('companyName', event.target.value)}
              placeholder="NorthStar Electric"
            />
          </Field>
          <Field label="Email">
            <Input
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="customer@example.com"
            />
            {errors.email ? (
              <p className="text-xs text-rose-300">{errors.email}</p>
            ) : null}
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              placeholder="+1 555 0100"
            />
          </Field>
          <Field
            label="Customer Status"
            helper="Relationship state for this customer."
          >
            <Select
              value={form.lifecycleStatus}
              onChange={(event) =>
                update(
                  'lifecycleStatus',
                  event.target.value as CommerceCustomerStatus,
                )
              }
            >
              {COMMERCE_CUSTOMER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Customer Type"
            helper="Business or buyer classification."
          >
            <CustomerTypeSelector
              workspaceId={workspaceId}
              customers={customers}
              types={customerTypes}
              selectedTypeId={form.customerTypeId}
              onChange={(typeId) => update('customerTypeId', typeId)}
              onRegistryChanged={onTypesChanged}
            />
          </Field>
          <Field label="Tags">
            <CustomerTagSelector
              workspaceId={workspaceId}
              customers={customers}
              tags={customerTags}
              selectedTagIds={form.tags}
              onChange={(tagIds) => update('tags', tagIds)}
              onRegistryChanged={onTagsChanged}
            />
            <p className="text-neutral-text-secondary text-xs">
              Reusable workspace labels for organization, reporting, and
              automation.
            </p>
          </Field>
        </div>
        {errors.customer ? (
          <p className="text-xs text-rose-300">{errors.customer}</p>
        ) : null}
      </Section>
      <Section title="Addresses">
        <div className="grid gap-4 md:grid-cols-2">
          <AddressFields
            title="Billing"
            prefix="billing"
            form={form}
            update={update}
          />
          <AddressFields
            title="Shipping"
            prefix="shipping"
            form={form}
            update={update}
          />
        </div>
        <Field label="Default Shipping">
          <Select
            value={form.defaultShippingAddress}
            onChange={(event) =>
              update(
                'defaultShippingAddress',
                event.target.value as 'BILLING' | 'SHIPPING',
              )
            }
          >
            <option value="SHIPPING">Shipping address</option>
            <option value="BILLING">Billing address</option>
          </Select>
        </Field>
      </Section>
      <Section title="Customer Notes">
        <Field label="Customer Notes">
          <Textarea
            value={form.clientNotes}
            onChange={(event) => update('clientNotes', event.target.value)}
            placeholder="Shared relationship notes."
            rows={4}
          />
        </Field>
        <Field label="Internal Notes">
          <Textarea
            value={form.internalNotes}
            onChange={(event) => update('internalNotes', event.target.value)}
            placeholder="Internal customer-specific notes."
            rows={4}
          />
        </Field>
      </Section>
    </div>
  )
}

function AddressFields({
  title,
  prefix,
  form,
  update,
}: {
  title: string
  prefix: 'billing' | 'shipping'
  form: CustomerFormState
  update: <K extends keyof CustomerFormState>(
    key: K,
    value: CustomerFormState[K],
  ) => void
}) {
  const key = (field: string) => `${prefix}${field}` as keyof CustomerFormState
  return (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
      <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
        {title}
      </h4>
      {[
        ['Line1', 'Address line 1'],
        ['Line2', 'Address line 2'],
        ['City', 'City'],
        ['Region', 'State / Region'],
        ['PostalCode', 'Postal Code'],
        ['Country', 'Country'],
      ].map(([field, label]) =>
        (() => {
          const fieldKey = key(field)
          return (
            <Input
              key={field}
              value={String(form[fieldKey] ?? '')}
              onChange={(event) =>
                update(
                  fieldKey,
                  event.target.value as CustomerFormState[typeof fieldKey],
                )
              }
              placeholder={label}
              aria-label={`${title} ${label}`}
            />
          )
        })(),
      )}
    </div>
  )
}

function CustomerTypeSelector({
  workspaceId,
  customers,
  types,
  selectedTypeId,
  onChange,
  onRegistryChanged,
}: {
  workspaceId: string
  customers: CommerceCustomer[]
  types: CommerceCustomerTypeDefinition[]
  selectedTypeId: string
  onChange: (typeId: string) => void
  onRegistryChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const activeTypes = types
    .filter((type) => type.isActive)
    .sort((first, second) => first.sortOrder - second.sortOrder)
  const selectedType = types.find((type) => type.id === selectedTypeId)

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const selectableTypes =
    selectedType?.isArchived &&
    !activeTypes.some((type) => type.id === selectedType.id)
      ? [selectedType, ...activeTypes]
      : activeTypes

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select customer type"
        onClick={() => setOpen((current) => !current)}
        className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-left text-sm text-neutral-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      >
        {selectedType ? (
          <span>
            {selectedType.name}
            {selectedType.isArchived ? ' · Archived' : ''}
          </span>
        ) : (
          <span className="text-neutral-text-secondary">Not set</span>
        )}
      </button>
      {open ? (
        <div className="absolute z-50 mt-2 w-full min-w-72 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
          <div className="max-h-64 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-900 hover:text-white',
                !selectedTypeId
                  ? 'bg-cyan-300/10 text-cyan-100'
                  : 'text-neutral-200',
              )}
            >
              Not set
              {!selectedTypeId ? <Check className="h-4 w-4" /> : null}
            </button>
            {selectableTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  onChange(type.id)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-900 hover:text-white',
                  selectedTypeId === type.id
                    ? 'bg-cyan-300/10 text-cyan-100'
                    : 'text-neutral-200',
                )}
              >
                <span>
                  {type.name}
                  {type.isArchived ? (
                    <span className="text-neutral-text-secondary ml-2 text-xs">
                      Archived
                    </span>
                  ) : null}
                </span>
                {selectedTypeId === type.id ? (
                  <Check className="h-4 w-4" />
                ) : null}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-800 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setManagerOpen(true)
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-neutral-300 transition hover:bg-slate-900 hover:text-white"
            >
              Manage customer types
            </button>
          </div>
        </div>
      ) : null}
      {managerOpen ? (
        <CustomerTypeManagerModal
          workspaceId={workspaceId}
          customers={customers}
          types={types}
          onClose={() => setManagerOpen(false)}
          onRegistryChanged={onRegistryChanged}
        />
      ) : null}
    </div>
  )
}

function CustomerTagSelector({
  workspaceId,
  customers,
  tags,
  selectedTagIds,
  onChange,
  onRegistryChanged,
}: {
  workspaceId: string
  customers: CommerceCustomer[]
  tags: CommerceCustomerTag[]
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  onRegistryChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const usage = useMemo(
    () => getCustomerTagUsageMap(tags, customers),
    [customers, tags],
  )
  const selectedTags = selectedTagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is CommerceCustomerTag => Boolean(tag))
  const activeTags = tags
    .filter((tag) => tag.status === 'active')
    .filter((tag) =>
      tag.label.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((first, second) => first.label.localeCompare(second.label))
  const normalizedQuery = normalizeCustomerTagLabel(query)
  const canCreate =
    normalizedQuery.length > 0 &&
    !tags.some((tag) => tag.normalizedLabel === normalizedQuery) &&
    !validateCustomerTagLabel(query, tags)

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const toggleTag = (tagId: string) => {
    onChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId],
    )
  }

  const createTag = () => {
    const result = createPreviewCustomerTag({ workspaceId, label: query })
    if (!result.tag) return
    onRegistryChanged()
    onChange([...selectedTagIds, result.tag.id])
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-left text-sm text-neutral-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select customer tags"
      >
        {selectedTags.length ? (
          <span className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-xs text-cyan-100"
              >
                {tag.label}
                {tag.status === 'archived' ? ' · Archived' : ''}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${tag.label} tag`}
                  className="rounded-full px-1 text-cyan-100/80 hover:bg-cyan-300/15 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleTag(tag.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.stopPropagation()
                      toggleTag(tag.id)
                    }
                  }}
                >
                  ×
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-neutral-text-secondary">
            Select customer tags
          </span>
        )}
      </button>
      {open ? (
        <div className="absolute z-50 mt-2 w-full min-w-72 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
          <div className="border-b border-slate-800 p-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tags..."
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {activeTags.length ? (
              activeTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
                    selectedTagIds.includes(tag.id)
                      ? 'bg-cyan-300/10 text-cyan-100'
                      : 'text-neutral-200 hover:bg-slate-900 hover:text-white',
                  )}
                >
                  <span>
                    {tag.label}
                    <span className="text-neutral-text-secondary ml-2 text-xs">
                      {usage.get(tag.id) ?? 0}
                    </span>
                  </span>
                  {selectedTagIds.includes(tag.id) ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                </button>
              ))
            ) : (
              <p className="text-neutral-text-secondary px-3 py-2 text-sm">
                {tags.length
                  ? 'No tags match this search.'
                  : 'No tags created.'}
              </p>
            )}
            {canCreate ? (
              <button
                type="button"
                onClick={createTag}
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10"
              >
                <Plus className="h-4 w-4" />
                Create tag “{query.trim()}”
              </button>
            ) : null}
          </div>
          <div className="border-t border-slate-800 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setManagerOpen(true)
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-neutral-300 transition hover:bg-slate-900 hover:text-white"
            >
              Manage tags
            </button>
          </div>
        </div>
      ) : null}
      {managerOpen ? (
        <CustomerTagManagerModal
          workspaceId={workspaceId}
          customers={customers}
          tags={tags}
          selectedTagIds={selectedTagIds}
          onSelectedTagIdsChange={onChange}
          onClose={() => setManagerOpen(false)}
          onRegistryChanged={onRegistryChanged}
        />
      ) : null}
    </div>
  )
}

function CommerceManagerModalShell({
  title,
  description,
  children,
  onClose,
  suppressEscape = false,
}: {
  title: string
  description: string
  children: ReactNode
  onClose: () => void
  suppressEscape?: boolean
}) {
  const [portalReady, setPortalReady] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!portalReady) return
    const previousActive = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (suppressEscape) return
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = document.querySelector<HTMLElement>(
        '[data-commerce-manager-dialog="true"]',
      )
      if (!dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousActive?.focus?.()
    }
  }, [onClose, portalReady, suppressEscape])

  if (!portalReady) return null

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[70] bg-slate-950/70 backdrop-blur-sm"
      style={{ top: CUSTOMER_OVERLAY_TOP_OFFSET }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-label={title}
          data-commerce-manager-dialog="true"
          className="flex max-h-[min(760px,calc(100dvh-var(--dashboard-top-bar-height,3.5rem)-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-50">
                {title}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                {description}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="text-neutral-text-secondary rounded-full p-2 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
              aria-label={`Close ${title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </section>
      </div>
    </div>,
    document.body,
  )
}

function CustomerTypeManagerModal({
  workspaceId,
  customers,
  types,
  onClose,
  onRegistryChanged,
}: {
  workspaceId: string
  customers: CommerceCustomer[]
  types: CommerceCustomerTypeDefinition[]
  onClose: () => void
  onRegistryChanged: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDeleteType, setPendingDeleteType] =
    useState<CommerceCustomerTypeDefinition | null>(null)
  const usage = useMemo(
    () => getCustomerTypeUsageMap(types, customers),
    [customers, types],
  )
  const activeTypes = types
    .filter((type) => type.isActive)
    .sort((first, second) => first.sortOrder - second.sortOrder)
  const archivedTypes = types
    .filter((type) => type.isArchived)
    .sort((first, second) => first.sortOrder - second.sortOrder)

  const refresh = () => {
    setError(null)
    onRegistryChanged()
  }

  const createType = () => {
    const result = createPreviewCustomerType({ workspaceId, name })
    if (!result.type) {
      setError(result.errors.name ?? 'Customer type could not be created.')
      return
    }
    setName('')
    refresh()
  }

  const renameType = (type: CommerceCustomerTypeDefinition) => {
    const nextName = window.prompt('Rename customer type', type.name)
    if (nextName === null) return
    const result = renamePreviewCustomerType({
      workspaceId,
      typeId: type.id,
      name: nextName,
    })
    if (!result.type) {
      setError(result.errors.name ?? 'Customer type could not be renamed.')
      return
    }
    refresh()
  }

  const archiveType = (type: CommerceCustomerTypeDefinition) => {
    archivePreviewCustomerType({ workspaceId, typeId: type.id })
    refresh()
  }

  const restoreType = (type: CommerceCustomerTypeDefinition) => {
    restorePreviewCustomerType({ workspaceId, typeId: type.id })
    refresh()
  }

  const moveType = (
    type: CommerceCustomerTypeDefinition,
    direction: 'up' | 'down',
  ) => {
    reorderPreviewCustomerType({ workspaceId, typeId: type.id, direction })
    refresh()
  }

  const deleteType = (type: CommerceCustomerTypeDefinition) => {
    const usedBy = usage.get(type.id) ?? 0
    if (usedBy > 0) {
      setError(
        'This customer type is still assigned to customers. Remove it from those customers before deleting it permanently.',
      )
      return
    }
    setError(null)
    setPendingDeleteType(type)
  }

  const confirmDeleteType = () => {
    if (!pendingDeleteType) return
    const result = deleteUnusedPreviewCustomerType({
      workspaceId,
      typeId: pendingDeleteType.id,
      customers,
    })
    if (!result.deleted) {
      setError(result.errors.type ?? 'Customer type could not be deleted.')
      return
    }
    setPendingDeleteType(null)
    refresh()
  }

  return (
    <CommerceManagerModalShell
      title="Manage customer types"
      description="Create, reorder, archive, restore, and delete unused customer classifications for this workspace."
      onClose={onClose}
      suppressEscape={Boolean(pendingDeleteType)}
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/35 p-4">
          <h3 className="text-sm font-semibold text-neutral-100">
            Create customer type
          </h3>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Retail, Government, Wholesale..."
              aria-label="New customer type name"
            />
            <Button
              type="button"
              onClick={createType}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create
            </Button>
          </div>
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </div>

        <ManagerListSection
          title="Active types"
          empty="No active customer types."
          rows={activeTypes}
          usage={usage}
          renderActions={(type, index) => (
            <>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={index === 0}
                onClick={() => moveType(type, 'up')}
              >
                Up
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={index === activeTypes.length - 1}
                onClick={() => moveType(type, 'down')}
              >
                Down
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => renameType(type)}
              >
                Rename
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => archiveType(type)}
              >
                Archive
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={(usage.get(type.id) ?? 0) > 0}
                title={
                  (usage.get(type.id) ?? 0) > 0
                    ? 'Remove this type from customers before deleting it permanently.'
                    : 'Delete unused type'
                }
                onClick={() => deleteType(type)}
              >
                Delete unused
              </Button>
            </>
          )}
        />

        <ManagerListSection
          title="Archived types"
          empty="No archived customer types."
          rows={archivedTypes}
          usage={usage}
          renderActions={(type) => (
            <>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => restoreType(type)}
              >
                Restore
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => renameType(type)}
              >
                Rename
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={(usage.get(type.id) ?? 0) > 0}
                title={
                  (usage.get(type.id) ?? 0) > 0
                    ? 'Remove this type from customers before deleting it permanently.'
                    : 'Delete unused type'
                }
                onClick={() => deleteType(type)}
              >
                Delete unused
              </Button>
            </>
          )}
        />
      </div>
      <ConfirmDialog
        open={Boolean(pendingDeleteType)}
        title="Delete customer type?"
        description={
          pendingDeleteType ? (
            <span>
              Delete “{pendingDeleteType.name}” from this preview workspace.
              This customer type is not assigned to any customers and cannot be
              restored after deletion.
            </span>
          ) : null
        }
        confirmLabel="Delete type"
        destructive
        onOpenChange={(open) => {
          if (!open) setPendingDeleteType(null)
        }}
        onConfirm={confirmDeleteType}
      />
    </CommerceManagerModalShell>
  )
}

function CustomerTagManagerModal({
  workspaceId,
  customers,
  tags,
  selectedTagIds = [],
  onSelectedTagIdsChange,
  onClose,
  onRegistryChanged,
}: {
  workspaceId: string
  customers: CommerceCustomer[]
  tags: CommerceCustomerTag[]
  selectedTagIds?: string[]
  onSelectedTagIdsChange?: (tagIds: string[]) => void
  onClose: () => void
  onRegistryChanged: () => void
}) {
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDeleteTag, setPendingDeleteTag] =
    useState<CommerceCustomerTag | null>(null)
  const usage = useMemo(
    () => getCustomerTagUsageMap(tags, customers),
    [customers, tags],
  )
  const activeTags = tags
    .filter((tag) => tag.status === 'active')
    .sort((first, second) => first.label.localeCompare(second.label))
  const archivedTags = tags
    .filter((tag) => tag.status === 'archived')
    .sort((first, second) => first.label.localeCompare(second.label))

  const refresh = () => {
    setError(null)
    onRegistryChanged()
  }

  const createTag = () => {
    const result = createPreviewCustomerTag({ workspaceId, label })
    if (!result.tag) {
      setError(result.errors.label ?? 'Tag could not be created.')
      return
    }
    setLabel('')
    onSelectedTagIdsChange?.([...selectedTagIds, result.tag.id])
    refresh()
  }

  const renameTag = (tag: CommerceCustomerTag) => {
    const nextLabel = window.prompt('Rename customer tag', tag.label)
    if (nextLabel === null) return
    const result = renamePreviewCustomerTag({
      workspaceId,
      tagId: tag.id,
      label: nextLabel,
    })
    if (!result.tag) {
      setError(result.errors.label ?? 'Tag could not be renamed.')
      return
    }
    refresh()
  }

  const archiveTag = (tag: CommerceCustomerTag) => {
    archivePreviewCustomerTag({ workspaceId, tagId: tag.id })
    refresh()
  }

  const restoreTag = (tag: CommerceCustomerTag) => {
    restorePreviewCustomerTag({ workspaceId, tagId: tag.id })
    refresh()
  }

  const deleteTag = (tag: CommerceCustomerTag) => {
    const usedBy = usage.get(tag.id) ?? 0
    if (usedBy > 0) {
      setError(
        'This tag is still assigned to customers. Remove it from those customers before deleting it permanently.',
      )
      return
    }
    setError(null)
    setPendingDeleteTag(tag)
  }

  const confirmDeleteTag = () => {
    if (!pendingDeleteTag) return
    const result = deleteUnusedPreviewCustomerTag({
      workspaceId,
      tagId: pendingDeleteTag.id,
      customers,
    })
    if (!result.deleted) {
      setError(result.errors.tag ?? 'Tag could not be deleted.')
      return
    }
    onSelectedTagIdsChange?.(
      selectedTagIds.filter((tagId) => tagId !== pendingDeleteTag.id),
    )
    setPendingDeleteTag(null)
    refresh()
  }

  return (
    <CommerceManagerModalShell
      title="Manage tags"
      description="Create reusable workspace tags, archive labels you no longer use, and delete only unused tags."
      onClose={onClose}
      suppressEscape={Boolean(pendingDeleteTag)}
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/35 p-4">
          <h3 className="text-sm font-semibold text-neutral-100">Create tag</h3>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="VIP, Wholesale buyer, Needs follow-up..."
              aria-label="New tag name"
            />
            <Button
              type="button"
              onClick={createTag}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create
            </Button>
          </div>
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </div>

        <ManagerListSection
          title="Active tags"
          empty="No active tags."
          rows={activeTags}
          usage={usage}
          getLabel={(tag) => tag.label}
          renderActions={(tag) => (
            <>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => renameTag(tag)}
              >
                Rename
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => archiveTag(tag)}
              >
                Archive
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={(usage.get(tag.id) ?? 0) > 0}
                title={
                  (usage.get(tag.id) ?? 0) > 0
                    ? 'Remove this tag from customers before deleting it permanently.'
                    : 'Delete unused tag'
                }
                onClick={() => deleteTag(tag)}
              >
                Delete unused
              </Button>
            </>
          )}
        />

        <ManagerListSection
          title="Archived tags"
          empty="No archived tags."
          rows={archivedTags}
          usage={usage}
          getLabel={(tag) => tag.label}
          renderActions={(tag) => (
            <>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => restoreTag(tag)}
              >
                Restore
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => renameTag(tag)}
              >
                Rename
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={(usage.get(tag.id) ?? 0) > 0}
                title={
                  (usage.get(tag.id) ?? 0) > 0
                    ? 'Remove this tag from customers before deleting it permanently.'
                    : 'Delete unused tag'
                }
                onClick={() => deleteTag(tag)}
              >
                Delete unused
              </Button>
            </>
          )}
        />
      </div>
      <ConfirmDialog
        open={Boolean(pendingDeleteTag)}
        title="Delete customer tag?"
        description={
          pendingDeleteTag ? (
            <span>
              Delete “{pendingDeleteTag.label}” from this preview workspace.
              This tag is not assigned to any customers and cannot be restored
              after deletion.
            </span>
          ) : null
        }
        confirmLabel="Delete tag"
        destructive
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTag(null)
        }}
        onConfirm={confirmDeleteTag}
      />
    </CommerceManagerModalShell>
  )
}

function ManagerListSection<TItem extends { id: string; name?: string }>({
  title,
  empty,
  rows,
  usage,
  getLabel = (item) => item.name ?? item.id,
  renderActions,
}: {
  title: string
  empty: string
  rows: TItem[]
  usage: Map<string, number>
  getLabel?: (item: TItem) => string
  renderActions: (item: TItem, index: number) => ReactNode
}) {
  return (
    <section className="drawer-panel-surface rounded-2xl border p-4">
      <h3 className="text-app-primary text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.map((row, index) => {
            const usageCount = usage.get(row.id) ?? 0
            return (
              <div
                key={row.id}
                className="drawer-panel-muted flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-app-primary text-sm font-medium">
                    {getLabel(row)}
                  </p>
                  <p className="text-neutral-text-secondary mt-0.5 text-xs">
                    {usageCount} {usageCount === 1 ? 'customer' : 'customers'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {renderActions(row, index)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-neutral-text-secondary mt-3 text-sm">{empty}</p>
      )}
    </section>
  )
}

function FutureCommerceRelationships() {
  const [expanded, setExpanded] = useState(false)
  const futureItems = [
    'Returns',
    'Subscriptions',
    'Reviews',
    'Loyalty',
    'Support Tickets',
  ]

  return (
    <div className="drawer-panel-muted rounded-xl border border-dashed p-3">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      >
        <span>
          <span className="text-app-primary block text-sm font-semibold">
            Future commerce relationships
          </span>
          <span className="text-neutral-text-secondary mt-1 block text-xs">
            Returns, subscriptions, reviews, loyalty, and support records will
            appear here as those modules are enabled.
          </span>
        </span>
        <ChevronDown
          className={cn(
            'text-neutral-text-secondary mt-0.5 h-4 w-4 shrink-0 transition',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded ? (
        <ul className="text-neutral-text-secondary mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
          {futureItems.map((item) => (
            <li
              key={item}
              className="bg-app-surface-muted rounded-lg px-2 py-1.5"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function CustomerNotesCard({
  workspaceId,
  customer,
  canEdit,
  onReload,
}: {
  workspaceId: string
  customer: CommerceCustomer
  canEdit: boolean
  onReload: () => void
}) {
  const [editing, setEditing] = useState<'customer' | 'internal' | null>(null)
  const [customerNotes, setCustomerNotes] = useState(customer.clientNotes ?? '')
  const [internalNotes, setInternalNotes] = useState(
    customer.internalNotes ?? '',
  )

  useEffect(() => {
    setCustomerNotes(customer.clientNotes ?? '')
    setInternalNotes(customer.internalNotes ?? '')
    setEditing(null)
  }, [customer.clientNotes, customer.id, customer.internalNotes])

  function saveCustomerNotes() {
    updatePreviewCustomer({
      workspaceId,
      customerId: customer.id,
      changes: { clientNotes: customerNotes },
    })
    setEditing(null)
    onReload()
  }

  function saveInternalNotes() {
    updatePreviewCustomer({
      workspaceId,
      customerId: customer.id,
      changes: { internalNotes },
    })
    setEditing(null)
    onReload()
  }

  return (
    <section className="drawer-panel-surface rounded-2xl border p-4">
      <div>
        <h3 className="text-app-primary text-sm font-semibold">
          Customer Notes
        </h3>
        <p className="text-neutral-text-secondary mt-1 text-xs">
          Customer notes are shared forever. Internal notes stay with this
          customer.
        </p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <EditableNote
          label="Customer Notes"
          value={customerNotes}
          editing={editing === 'customer'}
          disabled={!canEdit}
          placeholder="Relationship details, preferences, purchase context..."
          onEdit={() => setEditing('customer')}
          onChange={setCustomerNotes}
          onCancel={() => {
            setCustomerNotes(customer.clientNotes ?? '')
            setEditing(null)
          }}
          onSave={saveCustomerNotes}
        />
        <EditableNote
          label="Internal Notes"
          value={internalNotes}
          editing={editing === 'internal'}
          disabled={!canEdit}
          placeholder="Internal customer-specific context..."
          onEdit={() => setEditing('internal')}
          onChange={setInternalNotes}
          onCancel={() => {
            setInternalNotes(customer.internalNotes ?? '')
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
    <div className="drawer-panel-muted rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
          {label}
        </h4>
        {!editing ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onEdit}
            className="text-neutral-text-secondary hover:bg-app-surface-hover hover:text-app-primary rounded-lg p-1.5 transition disabled:cursor-not-allowed disabled:opacity-50"
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
          className="border-app bg-app-surface-raised text-app-primary hover:bg-app-surface-hover disabled:hover:border-app disabled:hover:bg-app-surface-raised mt-2 block min-h-20 w-full rounded-lg border p-3 text-left text-sm transition hover:border-cyan-500/25 disabled:cursor-default"
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

function TimelineList({
  activities,
  empty,
}: {
  activities: CommerceActivity[]
  empty: string
}) {
  if (!activities.length) {
    return <p className="text-neutral-text-secondary text-sm">{empty}</p>
  }
  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="border-l border-slate-700 pl-3">
          <p className="text-app-primary text-sm font-medium">
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
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="drawer-panel-surface rounded-2xl border p-4">
      <h3 className="text-app-primary text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  required,
  helper,
  children,
}: {
  label: string
  required?: boolean
  helper?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-neutral-text-secondary text-xs font-medium">
        {label}
        {required ? <span className="text-cyan-300"> *</span> : null}
      </span>
      {helper ? (
        <p className="text-neutral-text-secondary text-xs">{helper}</p>
      ) : null}
      {children}
    </label>
  )
}

function DescriptionRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-app flex flex-wrap items-start justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
      <p className="text-neutral-text-secondary text-xs">{label}</p>
      <div className="text-app-primary max-w-[70%] text-right text-sm font-medium">
        {value}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="drawer-panel-muted rounded-xl border p-3">
      <p className="text-neutral-text-secondary text-xs">{label}</p>
      <p className="text-app-primary mt-2 text-sm font-semibold">{value}</p>
    </div>
  )
}

function AddressDisplay({
  title,
  address,
}: {
  title: string
  address?: CommerceAddress
}) {
  const lines = formatCommerceAddressLines(address)
  return (
    <div className="drawer-panel-muted rounded-xl border p-3">
      <h4 className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
        {title}
      </h4>
      <div className="text-app-primary mt-2 space-y-1 text-sm">
        {lines.length ? (
          lines.map((line) => <p key={line}>{line}</p>)
        ) : (
          <p className="text-neutral-text-secondary">Not set</p>
        )}
      </div>
    </div>
  )
}

function RelatedRecordLink({
  label,
  title,
  description,
  href,
}: {
  label: string
  title: string
  description: string
  href?: string
}) {
  if (!href) {
    return (
      <div className="drawer-panel-muted rounded-xl border p-3">
        <p className="text-neutral-text-secondary text-xs font-semibold uppercase tracking-[0.16em]">
          {label}
        </p>
        <p className="text-app-primary mt-1 text-sm font-semibold">{title}</p>
        <p className="text-neutral-text-secondary mt-0.5 text-xs">
          {description}
        </p>
      </div>
    )
  }
  return (
    <a
      href={href}
      onKeyDown={(event) => {
        if (event.key === ' ') {
          event.preventDefault()
          event.currentTarget.click()
        }
      }}
      className="drawer-panel-muted flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition hover:border-cyan-500/30 hover:bg-cyan-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 dark:hover:border-cyan-300/30 dark:hover:bg-cyan-300/[0.04]"
    >
      <span className="min-w-0">
        <span className="text-neutral-text-secondary block text-xs font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
        <span className="text-app-primary mt-1 block truncate text-sm font-semibold">
          {title}
        </span>
        <span className="text-neutral-text-secondary mt-0.5 block text-xs">
          {description}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 -rotate-90 text-cyan-200/80" />
    </a>
  )
}
