'use client'

import {
  Archive,
  Boxes,
  ChevronDown,
  Copy,
  Edit3,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  RotateCcw,
  Save,
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
import {
  COMMERCE_INVENTORY_STATE_OPTIONS,
  COMMERCE_PRODUCT_STATUS_OPTIONS,
  COMMERCE_PRODUCT_TABLE_COLUMNS,
  COMMERCE_PRODUCT_VARIANT_LIMITS,
  getCommerceStatusLabel,
  type CommerceInventoryState,
} from '@/lib/commerce/commerceRegistry'
import {
  generateVariantCombinations,
  getProductCategoryOptions,
  getProductInventoryQuantity,
  getProductInventoryState,
  getProductSkuDisplay,
  isProductLowStock,
  selectProductCounts,
  selectProducts,
  type ProductSortKey,
  type ProductViewKey,
} from '@/lib/commerce/productCatalog'
import {
  calculateCommerceMargin,
  formatCommerceMoney,
  formatProductPriceRange,
} from '@/lib/commerce/productPricing'
import { commerceNumericInputRules } from '@/lib/commerce/numericInputRules'
import {
  archivePreviewProduct,
  commercePreviewProductsChangedEvent,
  createPreviewProduct,
  duplicatePreviewProduct,
  getPreviewProductActivities,
  getPreviewProducts,
  restorePreviewProduct,
  updatePreviewProduct,
} from '@/lib/commerce/previewCommerceStorage'
import type {
  CommerceActivity,
  CommerceMoney,
  CommerceProduct,
  CommerceProductStatus,
  CommerceProductVariant,
} from '@/lib/commerce/types'
import { cn } from '@/lib/utils'
import { useClearFilters } from '@/hooks/useClearFilters'

type Props = {
  workspaceId: string
  canEdit?: boolean
}

type ProductFormState = {
  name: string
  description: string
  status: CommerceProductStatus
  sku: string
  barcode: string
  category: string
  vendor: string
  price: string
  currency: string
  compareAtPrice: string
  cost: string
  taxable: boolean
  trackInventory: boolean
  inventoryQuantity: string
  lowStockThreshold: string
  imageUrl: string
  tags: string
  productNotes: string
  hasVariants: boolean
  optionGroups: ProductOptionGroup[]
  variantsGenerated: boolean
  variants: CommerceProductVariant[]
}

type ProductOptionGroup = {
  id: string
  name: string
  values: Array<{ id: string; value: string }>
}

const PRODUCT_OVERLAY_TOP_OFFSET = 'var(--dashboard-top-bar-height, 3.5rem)'
const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const statusVariant: Record<CommerceProductStatus, BadgeVariant> = {
  DRAFT: 'slate',
  ACTIVE: 'green',
  ARCHIVED: 'gray',
}

const viewTabs: Array<{ id: ProductViewKey; label: string }> = [
  { id: 'all', label: 'All Products' },
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Draft' },
  { id: 'archived', label: 'Archived' },
  { id: 'low-stock', label: 'Low Stock' },
]

function getProductStatusForView(
  view: ProductViewKey,
): 'ALL' | CommerceProductStatus {
  if (view === 'active') return 'ACTIVE'
  if (view === 'draft') return 'DRAFT'
  if (view === 'archived') return 'ARCHIVED'
  return 'ALL'
}

const summaryViews: Array<{
  view: ProductViewKey
  label: string
  tone?: BadgeVariant
  ariaLabel: string
  countKey: keyof ReturnType<typeof selectProductCounts>
}> = [
  {
    view: 'all',
    label: 'Total Products',
    ariaLabel: 'Show all products',
    countKey: 'all',
  },
  {
    view: 'active',
    label: 'Active Products',
    tone: 'green',
    ariaLabel: 'Show active products',
    countKey: 'active',
  },
  {
    view: 'draft',
    label: 'Draft Products',
    tone: 'slate',
    ariaLabel: 'Show draft products',
    countKey: 'draft',
  },
  {
    view: 'low-stock',
    label: 'Low Stock',
    tone: 'orange',
    ariaLabel: 'Show low-stock products',
    countKey: 'lowStock',
  },
]

const sortOptions: Array<{ value: ProductSortKey; label: string }> = [
  { value: 'updated-desc', label: 'Recently Updated' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'price-asc', label: 'Price Low-High' },
  { value: 'price-desc', label: 'Price High-Low' },
  { value: 'inventory-asc', label: 'Inventory Low-High' },
]

function emptyForm(): ProductFormState {
  return {
    name: '',
    description: '',
    status: 'DRAFT',
    sku: '',
    barcode: '',
    category: '',
    vendor: '',
    price: '0',
    currency: 'USD',
    compareAtPrice: '',
    cost: '',
    taxable: true,
    trackInventory: false,
    inventoryQuantity: '',
    lowStockThreshold: '',
    imageUrl: '',
    tags: '',
    productNotes: '',
    hasVariants: false,
    optionGroups: [],
    variantsGenerated: false,
    variants: [],
  }
}

function formFromProduct(product: CommerceProduct): ProductFormState {
  return {
    name: product.name,
    description: product.description ?? '',
    status: product.status,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    category: product.category ?? '',
    vendor: product.vendor ?? '',
    price: String(product.price.amount),
    currency: product.price.currency,
    compareAtPrice:
      product.compareAtPrice?.amount != null
        ? String(product.compareAtPrice.amount)
        : '',
    cost: product.cost?.amount != null ? String(product.cost.amount) : '',
    taxable: product.taxable,
    trackInventory: product.trackInventory,
    inventoryQuantity:
      product.inventoryQuantity != null
        ? String(product.inventoryQuantity)
        : '',
    lowStockThreshold:
      product.lowStockThreshold != null
        ? String(product.lowStockThreshold)
        : '',
    imageUrl: product.imageUrl ?? '',
    tags: (product.tags ?? []).join(', '),
    productNotes: product.productNotes ?? '',
    hasVariants: product.hasVariants,
    optionGroups: deriveOptionGroups(product.variants),
    variantsGenerated: product.variants.length > 0,
    variants: product.variants,
  }
}

function moneyFromAmount(
  amount: string,
  currency: string,
): CommerceMoney | undefined {
  if (amount.trim() === '') return undefined
  return { amount: Number(amount), currency: currency || 'USD' }
}

function productInputFromForm(
  form: ProductFormState,
): Partial<CommerceProduct> {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    status: form.status,
    sku: form.sku.trim() || undefined,
    barcode: form.barcode.trim() || undefined,
    category: form.category.trim() || undefined,
    vendor: form.vendor.trim() || undefined,
    price: moneyFromAmount(form.price, form.currency) ?? {
      amount: 0,
      currency: form.currency || 'USD',
    },
    compareAtPrice: moneyFromAmount(form.compareAtPrice, form.currency),
    cost: moneyFromAmount(form.cost, form.currency),
    taxable: form.taxable,
    trackInventory: form.trackInventory,
    inventoryQuantity:
      form.inventoryQuantity.trim() === ''
        ? undefined
        : Number(form.inventoryQuantity),
    lowStockThreshold:
      form.lowStockThreshold.trim() === ''
        ? undefined
        : Number(form.lowStockThreshold),
    imageUrl: form.imageUrl.trim() || undefined,
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    productNotes: form.productNotes.trim() || undefined,
    hasVariants: form.hasVariants,
    variants: form.hasVariants ? form.variants : [],
  }
}

function createLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function deriveOptionGroups(
  variants: CommerceProductVariant[],
): ProductOptionGroup[] {
  const groups = new Map<string, Set<string>>()
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.optionValues ?? {})) {
      if (!groups.has(name)) groups.set(name, new Set())
      if (value.trim()) groups.get(name)?.add(value)
    }
  }
  return Array.from(groups.entries()).map(([name, values], index) => ({
    id: `option_${index}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name,
    values: Array.from(values).map((value, valueIndex) => ({
      id: `value_${index}_${valueIndex}_${value.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      value,
    })),
  }))
}

function normalizeOptionGroups(groups: ProductOptionGroup[]) {
  return groups
    .map((group) => {
      const seen = new Set<string>()
      return {
        name: group.name.trim(),
        values: group.values
          .map((entry) => entry.value.trim())
          .filter((value) => {
            const key = value.toLowerCase()
            if (!value || seen.has(key)) return false
            seen.add(key)
            return true
          }),
      }
    })
    .filter((group) => group.name && group.values.length)
}

function validateOptionGroups(groups: ProductOptionGroup[]) {
  const errors: string[] = []
  const names = new Set<string>()
  for (const group of groups) {
    const name = group.name.trim()
    if (!name) errors.push('Each option needs a name.')
    const key = name.toLowerCase()
    if (key && names.has(key))
      errors.push(`Option names must be unique: ${name}.`)
    if (key) names.add(key)
    const values = group.values
      .map((entry) => entry.value.trim())
      .filter(Boolean)
    if (name && values.length === 0) {
      errors.push(`${name} needs at least one value.`)
    }
  }
  return Array.from(new Set(errors))
}

function mergeGeneratedVariants({
  form,
  combinations,
}: {
  form: ProductFormState
  combinations: Array<Record<string, string>>
}): CommerceProductVariant[] {
  const existingByOptions = new Map(
    form.variants.map((variant) => [
      JSON.stringify(variant.optionValues ?? {}),
      variant,
    ]),
  )
  return combinations.map((optionValues, index) => {
    const key = JSON.stringify(optionValues)
    const existing = existingByOptions.get(key)
    return {
      id: existing?.id ?? createLocalId('variant'),
      workspaceId: existing?.workspaceId ?? '',
      productId: existing?.productId ?? '',
      name: Object.values(optionValues).join(' / '),
      optionValues,
      sku: existing?.sku ?? '',
      barcode: existing?.barcode,
      status: existing?.status ?? form.status,
      price: existing?.price,
      cost: existing?.cost,
      inventoryQuantity: existing?.inventoryQuantity,
      createdAt:
        existing?.createdAt ?? new Date(Date.now() + index).toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function productViewForStatus(status: CommerceProductStatus): ProductViewKey {
  if (status === 'ACTIVE') return 'active'
  if (status === 'ARCHIVED') return 'archived'
  return 'draft'
}

function hasUngeneratedVariantOptions(form: ProductFormState) {
  return (
    form.hasVariants &&
    normalizeOptionGroups(form.optionGroups).length > 0 &&
    !form.variantsGenerated
  )
}

export function ProductCatalogPage({ workspaceId, canEdit = true }: Props) {
  const [products, setProducts] = useState<CommerceProduct[]>([])
  const [view, setView] = useState<ProductViewKey>('all')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | CommerceProductStatus>('ALL')
  const [category, setCategory] = useState('ALL')
  const [inventory, setInventory] = useState<CommerceInventoryState>('ALL')
  const [sort, setSort] = useState<ProductSortKey>('updated-desc')
  const expectedStatusForView = getProductStatusForView(view)
  const clearSecondaryFilters = () => {
    setQuery('')
    setStatus(expectedStatusForView)
    setCategory('ALL')
    setInventory('ALL')
  }
  const { activeFilterCount, clearFilters } = useClearFilters({
    filters: {
      query,
      status: status === expectedStatusForView ? '' : status,
      category: category === 'ALL' ? '' : category,
      inventory: inventory === 'ALL' ? '' : inventory,
    },
    onClear: clearSecondaryFilters,
  })
  const applyView = (nextView: ProductViewKey) => {
    setView(nextView)
    setQuery('')
    setStatus(getProductStatusForView(nextView))
    setCategory('ALL')
    setInventory('ALL')
  }
  const applyStatus = (nextStatus: 'ALL' | CommerceProductStatus) => {
    setStatus(nextStatus)
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<ProductFormState>(() =>
    emptyForm(),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  )
  const [highlightedProductId, setHighlightedProductId] = useState<
    string | null
  >(null)
  const [notice, setNotice] = useState<{
    text: string
    actionLabel?: string
    view?: ProductViewKey
  } | null>(null)

  const loadProducts = useCallback(
    () => setProducts(getPreviewProducts(workspaceId)),
    [workspaceId],
  )
  useEffect(() => {
    loadProducts()
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail
      if (!detail?.workspaceId || detail.workspaceId === workspaceId)
        loadProducts()
    }
    window.addEventListener(commercePreviewProductsChangedEvent, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(commercePreviewProductsChangedEvent, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [loadProducts, workspaceId])

  const counts = useMemo(() => selectProductCounts(products), [products])
  const categories = useMemo(
    () => getProductCategoryOptions(products),
    [products],
  )
  const rows = useMemo(
    () =>
      selectProducts(products, {
        view,
        query,
        status,
        category,
        inventory,
        sort,
      }),
    [products, view, query, status, category, inventory, sort],
  )
  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? null

  function createProduct(event: FormEvent) {
    event.preventDefault()
    if (hasUngeneratedVariantOptions(createForm)) {
      setErrors({
        variants:
          'Generate product variants before saving, or remove the variant setup.',
      })
      return
    }
    const result = createPreviewProduct({
      workspaceId,
      input: productInputFromForm(createForm),
    })
    if (!result.product) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setCreateOpen(false)
    setCreateForm(emptyForm())
    setSelectedProductId(result.product.id)
    setHighlightedProductId(result.product.id)
    window.setTimeout(() => setHighlightedProductId(null), 2200)
    loadProducts()
    const productView = productViewForStatus(result.product.status)
    if (view !== 'all' && view !== productView) {
      setNotice({
        text: `Product created as ${getCommerceStatusLabel(result.product.status)}.`,
        actionLabel: `View ${getCommerceStatusLabel(result.product.status)} products`,
        view: productView,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
            Product & Commerce
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-100">
            Products
          </h1>
          <p className="text-neutral-text-secondary mt-2 max-w-3xl text-sm leading-6">
            Create and manage the products customers can purchase.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          leftIcon={<PackagePlus className="h-4 w-4" />}
          disabled={!canEdit}
        >
          Add Product
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {summaryViews.map((summary) => (
          <SummaryCard
            key={summary.view}
            label={summary.label}
            value={counts[summary.countKey]}
            tone={summary.tone}
            active={view === summary.view}
            ariaLabel={summary.ariaLabel}
            onSelect={() => applyView(summary.view)}
          />
        ))}
      </div>

      <Card className="overflow-hidden">
        {notice ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-100">
            <span>{notice.text}</span>
            <div className="flex items-center gap-2">
              {notice.view ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-cyan-50 underline-offset-4 hover:underline"
                  onClick={() => {
                    applyView(notice.view!)
                    setNotice(null)
                  }}
                >
                  {notice.actionLabel}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full p-1 text-cyan-100/70 hover:bg-cyan-300/10 hover:text-cyan-50"
                onClick={() => setNotice(null)}
                aria-label="Dismiss product notice"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
        <div className="border-b border-slate-800 p-4">
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
                      ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100'
                      : 'border-slate-700 bg-slate-950/50 text-neutral-300 hover:border-slate-500 hover:text-white',
                  )}
                >
                  {tab.label}{' '}
                  <span className="text-neutral-text-secondary">
                    {tab.id === 'all'
                      ? counts.all
                      : tab.id === 'active'
                        ? counts.active
                        : tab.id === 'draft'
                          ? counts.draft
                          : tab.id === 'archived'
                            ? counts.archived
                            : counts.lowStock}
                  </span>
                </button>
              ))}
            </div>
            <ClearFiltersButton
              count={activeFilterCount}
              onClear={clearFilters}
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
            <label className="relative">
              <Search className="text-neutral-text-secondary pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, SKU, category, vendor, tags, variants..."
                className="pl-9"
                aria-label="Search products"
              />
            </label>
            <Select
              value={status}
              onChange={(event) =>
                applyStatus(event.target.value as 'ALL' | CommerceProductStatus)
              }
              aria-label="Filter by status"
            >
              <option value="ALL">All statuses</option>
              {COMMERCE_PRODUCT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="ALL">All categories</option>
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select
              value={inventory}
              onChange={(event) =>
                setInventory(event.target.value as CommerceInventoryState)
              }
              aria-label="Filter by inventory"
            >
              {COMMERCE_INVENTORY_STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as ProductSortKey)
              }
              aria-label="Sort products"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {products.length === 0 ? (
          <ProductEmptyState
            onAdd={() => setCreateOpen(true)}
            canEdit={canEdit}
          />
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-neutral-100">
              No products match these filters
            </p>
            <p className="text-neutral-text-secondary mt-1 text-sm">
              Adjust search, status, category, or inventory filters.
            </p>
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                {COMMERCE_PRODUCT_TABLE_COLUMNS.map((column) => (
                  <TH key={column.id}>{column.label}</TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {rows.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  highlighted={highlightedProductId === product.id}
                  onOpen={() => setSelectedProductId(product.id)}
                />
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {createOpen ? (
        <ProductModal
          title="Add Product"
          form={createForm}
          setForm={setCreateForm}
          errors={errors}
          onSubmit={createProduct}
          onClose={() => {
            setCreateOpen(false)
            setErrors({})
          }}
        />
      ) : null}

      {selectedProduct ? (
        <ProductDrawer
          workspaceId={workspaceId}
          product={selectedProduct}
          canEdit={canEdit}
          onClose={() => setSelectedProductId(null)}
          onReload={loadProducts}
          onSelect={setSelectedProductId}
        />
      ) : null}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'blue',
  active,
  ariaLabel,
  onSelect,
}: {
  label: string
  value: number
  tone?: BadgeVariant
  active?: boolean
  ariaLabel: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        'rounded-2xl border bg-slate-900/60 p-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
        active
          ? 'border-cyan-300/60 bg-cyan-300/[0.08] shadow-cyan-500/10'
          : 'border-slate-800 hover:border-cyan-300/25 hover:bg-cyan-300/[0.04]',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-neutral-text-secondary text-xs font-medium uppercase tracking-wide">
          {label}
        </p>
        <Badge variant={tone}>{value}</Badge>
      </div>
      <p className="mt-3 text-2xl font-semibold text-neutral-100">{value}</p>
    </button>
  )
}

function ProductEmptyState({
  onAdd,
  canEdit,
}: {
  onAdd: () => void
  canEdit: boolean
}) {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 p-6 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100">
          <Boxes className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-neutral-100">
          No products yet
        </h2>
        <p className="text-neutral-text-secondary mt-2 text-sm leading-6">
          Add the products customers can purchase, then use them in Orders and
          future automations.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={onAdd} disabled={!canEdit} size="sm">
            Add Product
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Import products - Coming later
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Connect a store - Coming later
          </Button>
        </div>
      </div>
    </div>
  )
}

function ProductRow({
  product,
  highlighted,
  onOpen,
}: {
  product: CommerceProduct
  highlighted?: boolean
  onOpen: () => void
}) {
  const margin = calculateCommerceMargin({
    price: product.price,
    cost: product.cost,
  })
  const inventoryState = getProductInventoryState(product)
  const quantity = getProductInventoryQuantity(product)
  return (
    <TR
      className={cn(
        'cursor-pointer',
        highlighted && 'bg-cyan-300/[0.08] ring-1 ring-inset ring-cyan-300/30',
      )}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen()
      }}
    >
      <TD>
        <div className="flex items-center gap-3">
          <ProductThumbnail product={product} />
          <div>
            <p className="font-medium text-neutral-100">{product.name}</p>
            <p className="text-neutral-text-secondary text-xs">
              {product.hasVariants
                ? `${product.variants.length} variants`
                : product.description || 'Single product'}
            </p>
          </div>
        </div>
      </TD>
      <TD>
        <Badge variant={statusVariant[product.status]}>
          {getCommerceStatusLabel(product.status)}
        </Badge>
      </TD>
      <TD className="text-neutral-text-secondary">
        {getProductSkuDisplay(product)}
      </TD>
      <TD className="text-neutral-text-secondary">
        {product.category ?? 'Not set'}
      </TD>
      <TD>{formatProductPriceRange(product)}</TD>
      <TD>{formatCommerceMoney(product.cost)}</TD>
      <TD>
        {margin.available &&
        margin.amount != null &&
        margin.percentage != null ? (
          <div>
            <p>
              {formatCommerceMoney({
                amount: margin.amount,
                currency: margin.currency,
              })}
            </p>
            <p className="text-neutral-text-secondary text-xs">
              {margin.percentage.toFixed(1)}%
            </p>
          </div>
        ) : (
          <span className="text-neutral-text-secondary">Not available</span>
        )}
      </TD>
      <TD>
        <div className="space-y-1">
          <p>
            {product.trackInventory
              ? product.hasVariants
                ? `${quantity ?? 0} total`
                : (quantity ?? 0)
              : 'Not tracked'}
          </p>
          {inventoryState === 'LOW_STOCK' ? (
            <Badge variant="orange">Low stock</Badge>
          ) : inventoryState === 'OUT_OF_STOCK' ? (
            <Badge variant="red">Out of stock</Badge>
          ) : null}
        </div>
      </TD>
      <TD className="text-neutral-text-secondary">
        {formatDate(product.updatedAt)}
      </TD>
    </TR>
  )
}

function ProductThumbnail({ product }: { product: CommerceProduct }) {
  const [failed, setFailed] = useState(false)
  if (product.imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.imageUrl}
        alt=""
        className="h-10 w-10 rounded-xl border border-slate-700 object-cover"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-cyan-100">
      <Boxes className="h-4 w-4" />
    </div>
  )
}

function ProductModal({
  title,
  form,
  setForm,
  errors,
  onSubmit,
  onClose,
}: {
  title: string
  form: ProductFormState
  setForm: (form: ProductFormState) => void
  errors: Record<string, string>
  onSubmit: (event: FormEvent) => void
  onClose: () => void
}) {
  const [portalReady, setPortalReady] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setPortalReady(true)
    returnFocusRef.current = document.activeElement as HTMLElement | null
    return () => {
      returnFocusRef.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    if (!portalReady) return
    formRef.current?.focus()
  }, [portalReady])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const container = formRef.current
      if (!container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const modal = (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center bg-slate-950/75 p-4"
      style={{ top: PRODUCT_OVERLAY_TOP_OFFSET }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        ref={formRef}
        onSubmit={onSubmit}
        tabIndex={-1}
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl outline-none"
        style={{
          maxHeight: `calc(100dvh - ${PRODUCT_OVERLAY_TOP_OFFSET} - 2rem)`,
        }}
      >
        <div className="shrink-0 border-b border-slate-800 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                {title}
              </h2>
              <p className="text-neutral-text-secondary mt-1 text-sm">
                Create a preview product for this workspace catalog.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-text-secondary rounded-full p-2 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <ProductForm form={form} setForm={setForm} errors={errors} />
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-800 bg-slate-950/95 p-5">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" leftIcon={<Save className="h-4 w-4" />}>
            Save Product
          </Button>
        </div>
      </form>
    </div>
  )

  return portalReady ? createPortal(modal, document.body) : null
}

function ProductDrawer({
  workspaceId,
  product,
  canEdit,
  onClose,
  onReload,
  onSelect,
}: {
  workspaceId: string
  product: CommerceProduct
  canEdit: boolean
  onClose: () => void
  onReload: () => void
  onSelect: (productId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ProductFormState>(() =>
    formFromProduct(product),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const drawerRef = useRef<HTMLElement | null>(null)
  const confirmRef = useRef<HTMLDivElement | null>(null)
  const activities = getPreviewProductActivities(workspaceId, product.id).slice(
    0,
    3,
  )
  const dirty =
    JSON.stringify(form) !== JSON.stringify(formFromProduct(product))

  useEffect(() => {
    setForm(formFromProduct(product))
    setErrors({})
    setEditing(false)
  }, [product])

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!portalReady) return
    drawerRef.current?.focus()
  }, [portalReady, product.id])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (confirmDiscard) {
          setConfirmDiscard(false)
          return
        }
        requestClose()
        return
      }
      if (event.key !== 'Tab') return
      const container = confirmDiscard ? confirmRef.current : drawerRef.current
      if (!container) return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function requestClose() {
    if (editing && dirty) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  function saveChanges() {
    if (hasUngeneratedVariantOptions(form)) {
      setErrors({
        variants:
          'Generate product variants before saving, or remove the variant setup.',
      })
      return
    }
    const result = updatePreviewProduct({
      workspaceId,
      productId: product.id,
      changes: productInputFromForm(form),
    })
    if (!result.product) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setEditing(false)
    onReload()
  }

  function duplicate() {
    setMoreOpen(false)
    const result = duplicatePreviewProduct({
      workspaceId,
      productId: product.id,
    })
    if (result.product) {
      onReload()
      onSelect(result.product.id)
    }
  }

  function archive() {
    setMoreOpen(false)
    if (!window.confirm(`Archive ${product.name}?`)) return
    archivePreviewProduct({ workspaceId, productId: product.id })
    onReload()
  }

  function restore() {
    setMoreOpen(false)
    restorePreviewProduct({ workspaceId, productId: product.id })
    onReload()
  }

  const drawer = (
    <div
      className="fixed inset-x-0 bottom-0 z-40 m-0 bg-slate-950/55 p-0 backdrop-blur-sm"
      style={{
        top: PRODUCT_OVERLAY_TOP_OFFSET,
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close product drawer"
        onClick={requestClose}
      />
      <aside
        ref={drawerRef}
        tabIndex={-1}
        className="absolute bottom-0 right-0 top-0 flex w-full max-w-2xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl"
      >
        <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                Product
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold text-neutral-100">
                {product.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[product.status]}>
                  {getCommerceStatusLabel(product.status)}
                </Badge>
                <Badge variant="slate">{getProductSkuDisplay(product)}</Badge>
                {isProductLowStock(product) ? (
                  <Badge variant="orange">Low stock</Badge>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="text-neutral-text-secondary rounded-full p-2 hover:bg-white/10 hover:text-white"
              aria-label="Close product drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button type="button" size="sm" onClick={saveChanges}>
                  Save Changes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false)
                    setForm(formFromProduct(product))
                    setErrors({})
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setEditing(true)}
                  disabled={!canEdit}
                  leftIcon={<Edit3 className="h-4 w-4" />}
                >
                  Edit
                </Button>
                <div className="relative">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => setMoreOpen((current) => !current)}
                    leftIcon={<MoreHorizontal className="h-4 w-4" />}
                    rightIcon={<ChevronDown className="h-3.5 w-3.5" />}
                  >
                    More
                  </Button>
                  {moreOpen ? (
                    <div className="absolute left-0 top-full z-20 mt-2 w-52 rounded-xl border border-slate-800 bg-slate-950 p-1 shadow-2xl">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-neutral-200 hover:bg-white/[0.06]"
                        onClick={duplicate}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicate Product
                      </button>
                      {product.status === 'ARCHIVED' ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-neutral-200 hover:bg-white/[0.06]"
                          onClick={restore}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore Product
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-300/[0.08]"
                          onClick={archive}
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive Product
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
          {editing && dirty ? (
            <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.08] p-3 text-xs text-amber-100">
              Unsaved changes to this product.
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {editing ? (
            <ProductForm form={form} setForm={setForm} errors={errors} />
          ) : (
            <ProductDetails
              workspaceId={workspaceId}
              product={product}
              activities={activities}
              canEdit={canEdit}
              onReload={onReload}
            />
          )}
        </div>
      </aside>
      {confirmDiscard ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4">
          <div
            ref={confirmRef}
            tabIndex={-1}
            className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold text-neutral-100">
              Unsaved product changes
            </h3>
            <p className="text-neutral-text-secondary mt-2 text-sm">
              You have changes that have not been saved.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDiscard(false)}
              >
                Continue editing
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setConfirmDiscard(false)
                  onClose()
                }}
              >
                Discard changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )

  return portalReady ? createPortal(drawer, document.body) : null
}

function ProductDetails({
  workspaceId,
  product,
  activities,
  canEdit,
  onReload,
}: {
  workspaceId: string
  product: CommerceProduct
  activities: CommerceActivity[]
  canEdit: boolean
  onReload: () => void
}) {
  const margin = calculateCommerceMargin({
    price: product.price,
    cost: product.cost,
  })
  const quantity = getProductInventoryQuantity(product)
  return (
    <div className="space-y-5">
      <Section title="Product overview">
        <DescriptionRow
          label="Description"
          value={product.description ?? 'Not set'}
        />
        <DescriptionRow
          label="Category"
          value={product.category ?? 'Not set'}
        />
        <DescriptionRow label="Vendor" value={product.vendor ?? 'Not set'} />
        <DescriptionRow label="Barcode" value={product.barcode ?? 'Not set'} />
        <DescriptionRow
          label="Tags"
          value={
            (product.tags ?? []).length ? product.tags!.join(', ') : 'Not set'
          }
        />
        <DescriptionRow
          label="Taxable"
          value={product.taxable ? 'Yes' : 'No'}
        />
        <DescriptionRow label="Created" value={formatDate(product.createdAt)} />
        <DescriptionRow label="Updated" value={formatDate(product.updatedAt)} />
      </Section>
      <Section title="Pricing and margin">
        <DescriptionRow
          label="Price"
          value={formatProductPriceRange(product)}
        />
        <DescriptionRow
          label="Compare-at price"
          value={formatCommerceMoney(product.compareAtPrice)}
        />
        <DescriptionRow
          label="Cost"
          value={formatCommerceMoney(product.cost)}
        />
        <DescriptionRow
          label="Margin"
          value={
            margin.available &&
            margin.amount != null &&
            margin.percentage != null
              ? `${formatCommerceMoney({
                  amount: margin.amount,
                  currency: margin.currency,
                })} (${margin.percentage.toFixed(1)}%)`
              : 'Not available'
          }
        />
      </Section>
      <Section title="Inventory">
        <DescriptionRow
          label="Tracking"
          value={product.trackInventory ? 'Enabled' : 'Disabled'}
        />
        <DescriptionRow
          label="Available quantity"
          value={product.trackInventory ? String(quantity ?? 0) : 'Not tracked'}
        />
        <DescriptionRow
          label="Low-stock threshold"
          value={
            product.lowStockThreshold != null
              ? String(product.lowStockThreshold)
              : 'Not set'
          }
        />
      </Section>
      <Section title="Variants">
        {product.hasVariants && product.variants.length ? (
          <div className="space-y-2">
            {product.variants.map((variant) => (
              <div
                key={variant.id}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-100">
                    {variant.name}
                  </p>
                  <Badge variant={statusVariant[variant.status]}>
                    {getCommerceStatusLabel(variant.status)}
                  </Badge>
                </div>
                <p className="text-neutral-text-secondary mt-1 text-xs">
                  SKU {variant.sku ?? 'Not set'} · Price{' '}
                  {formatCommerceMoney(variant.price ?? product.price)} ·
                  Inventory {variant.inventoryQuantity ?? 'Not set'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-text-secondary text-sm">No variants.</p>
        )}
      </Section>
      <ProductNotesCard
        workspaceId={workspaceId}
        product={product}
        canEdit={canEdit}
        onReload={onReload}
      />
      <Section title="Activity Timeline">
        {activities.length ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="border-l border-slate-700 pl-3">
                <p className="text-sm font-medium text-neutral-100">
                  {activity.title}
                </p>
                <p className="text-neutral-text-secondary text-xs">
                  {formatDate(activity.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-text-secondary text-sm">
            No product activity yet.
          </p>
        )}
      </Section>
    </div>
  )
}

function ProductNotesCard({
  workspaceId,
  product,
  canEdit,
  onReload,
}: {
  workspaceId: string
  product: CommerceProduct
  canEdit: boolean
  onReload: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(product.productNotes ?? '')

  useEffect(() => {
    setValue(product.productNotes ?? '')
    setEditing(false)
  }, [product.id, product.productNotes])

  function saveNotes() {
    updatePreviewProduct({
      workspaceId,
      productId: product.id,
      changes: { productNotes: value.trim() || undefined },
    })
    setEditing(false)
    onReload()
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">
            Product Notes
          </h3>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Internal information about this product.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setEditing(true)}
            className="text-neutral-text-secondary rounded-lg p-2 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Edit product notes"
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <Textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setValue(product.productNotes ?? '')
                setEditing(false)
              }
            }}
            placeholder="Supplier packaging changed in June."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setValue(product.productNotes ?? '')
                setEditing(false)
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={saveNotes}>
              Save Notes
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setEditing(true)}
          className="mt-3 block w-full rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left text-sm text-neutral-200 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04] disabled:cursor-default disabled:hover:border-slate-800 disabled:hover:bg-slate-950/50"
        >
          {product.productNotes ?? (
            <span className="text-neutral-text-secondary">
              Click to add internal product notes.
            </span>
          )}
        </button>
      )}
    </section>
  )
}

function ProductForm({
  form,
  setForm,
  errors,
}: {
  form: ProductFormState
  setForm: (form: ProductFormState) => void
  errors: Record<string, string>
}) {
  const update = <TKey extends keyof ProductFormState>(
    key: TKey,
    value: ProductFormState[TKey],
  ) => setForm({ ...form, [key]: value })
  return (
    <div className="mt-5 space-y-5">
      <Section title="Basic Details">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Product name" required>
            <Input
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Energy Drink - Original"
              error={errors.name}
            />
          </Field>
          <Field label="Status" required>
            <Select
              value={form.status}
              onChange={(event) =>
                update('status', event.target.value as CommerceProductStatus)
              }
            >
              {COMMERCE_PRODUCT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="Short catalog description for internal users."
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Category">
            <Input
              value={form.category}
              onChange={(event) => update('category', event.target.value)}
              placeholder="Beverages"
            />
          </Field>
          <Field label="Vendor">
            <Input
              value={form.vendor}
              onChange={(event) => update('vendor', event.target.value)}
              placeholder="Supplier or brand"
            />
          </Field>
          <Field label="Image URL">
            <Input
              value={form.imageUrl}
              onChange={(event) => update('imageUrl', event.target.value)}
              placeholder="https://example.com/product.jpg"
            />
          </Field>
        </div>
      </Section>

      <Section title="Pricing">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Price" required>
            <Input
              type="number"
              {...commerceNumericInputRules.money}
              value={form.price}
              onChange={(event) => update('price', event.target.value)}
              error={errors.price}
            />
          </Field>
          <Field label="Currency" required>
            <Input
              value={form.currency}
              onChange={(event) =>
                update('currency', event.target.value.toUpperCase())
              }
              placeholder="USD"
            />
          </Field>
          <Field label="Cost">
            <Input
              type="number"
              {...commerceNumericInputRules.money}
              value={form.cost}
              onChange={(event) => update('cost', event.target.value)}
              error={errors.cost}
            />
          </Field>
          <Field label="Compare-at price">
            <Input
              type="number"
              {...commerceNumericInputRules.money}
              value={form.compareAtPrice}
              onChange={(event) => update('compareAtPrice', event.target.value)}
              error={errors.compareAtPrice}
            />
          </Field>
        </div>
      </Section>

      <Section title="Inventory">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="SKU">
            <Input
              value={form.sku}
              onChange={(event) => update('sku', event.target.value)}
              placeholder="SKU-001"
              error={errors.sku}
            />
          </Field>
          <Field label="Barcode">
            <Input
              value={form.barcode}
              onChange={(event) => update('barcode', event.target.value)}
              placeholder="012345678901"
            />
          </Field>
          <div />
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-neutral-200">
            <input
              type="checkbox"
              checked={form.taxable}
              onChange={(event) => update('taxable', event.target.checked)}
            />
            Taxable
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-neutral-200">
            <input
              type="checkbox"
              checked={form.trackInventory}
              onChange={(event) =>
                update('trackInventory', event.target.checked)
              }
            />
            Track inventory
          </label>
          <Field label="Inventory quantity">
            <Input
              type="number"
              {...commerceNumericInputRules.inventory}
              value={form.inventoryQuantity}
              onChange={(event) =>
                update('inventoryQuantity', event.target.value)
              }
              error={errors.inventoryQuantity}
              disabled={!form.trackInventory}
            />
            {!form.trackInventory ? (
              <p className="text-neutral-text-secondary mt-1 text-[11px]">
                Enable inventory tracking to set a quantity.
              </p>
            ) : null}
          </Field>
          <Field label="Low-stock threshold">
            <Input
              type="number"
              {...commerceNumericInputRules.inventory}
              value={form.lowStockThreshold}
              onChange={(event) =>
                update('lowStockThreshold', event.target.value)
              }
              error={errors.lowStockThreshold}
              disabled={!form.trackInventory}
            />
            {!form.trackInventory ? (
              <p className="text-neutral-text-secondary mt-1 text-[11px]">
                Enable inventory tracking to use low-stock alerts.
              </p>
            ) : null}
          </Field>
        </div>
      </Section>

      <VariantEditor form={form} setForm={setForm} error={errors.variants} />

      <Section title="Additional Information">
        <Field label="Tags">
          <Input
            value={form.tags}
            onChange={(event) => update('tags', event.target.value)}
            placeholder="seasonal, wholesale"
          />
        </Field>
        <p className="text-neutral-text-secondary mb-2 text-xs">
          Internal information about this product.
        </p>
        <Textarea
          value={form.productNotes}
          onChange={(event) => update('productNotes', event.target.value)}
          placeholder="Confirm label approval before next production run."
        />
      </Section>
    </div>
  )
}

function VariantEditor({
  form,
  setForm,
  error,
}: {
  form: ProductFormState
  setForm: (form: ProductFormState) => void
  error?: string
}) {
  const [localError, setLocalError] = useState<string | null>(null)
  const optionGroups = form.optionGroups

  function updateOptionGroup(
    groupId: string,
    changes: Partial<ProductOptionGroup>,
  ) {
    setForm({
      ...form,
      variantsGenerated: false,
      optionGroups: optionGroups.map((group) =>
        group.id === groupId ? { ...group, ...changes } : group,
      ),
    })
  }

  function updateOptionValue(groupId: string, valueId: string, value: string) {
    setForm({
      ...form,
      variantsGenerated: false,
      optionGroups: optionGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              values: group.values.map((entry) =>
                entry.id === valueId ? { ...entry, value } : entry,
              ),
            }
          : group,
      ),
    })
  }

  function generate() {
    const groupErrors = validateOptionGroups(optionGroups)
    if (groupErrors.length) {
      setLocalError(groupErrors[0] ?? 'Review variant options.')
      return
    }
    const options = normalizeOptionGroups(optionGroups)
    const combinations = generateVariantCombinations(options)
    if (combinations === null) {
      setLocalError(
        `This setup creates more than ${COMMERCE_PRODUCT_VARIANT_LIMITS.maxVariants} variants. Remove values before generating.`,
      )
      return
    }
    setLocalError(null)
    setForm({
      ...form,
      hasVariants: true,
      optionGroups: optionGroups.map((group) => ({
        ...group,
        name: group.name.trim(),
        values: group.values
          .map((entry) => ({ ...entry, value: entry.value.trim() }))
          .filter((entry) => entry.value),
      })),
      variantsGenerated: true,
      variants: mergeGeneratedVariants({ form, combinations }),
    })
  }

  function confirmVariantStructureChange() {
    return (
      form.variants.length === 0 ||
      window.confirm(
        'Changing this option may remove generated variants and their edited fields. Continue?',
      )
    )
  }

  const generatedCount = form.variants.length
  const normalizedOptionGroups = normalizeOptionGroups(optionGroups)
  const potentialCount = normalizedOptionGroups.reduce(
    (total, group) => total * group.values.length,
    optionGroups.length ? 1 : 0,
  )
  const canGenerateVariants = normalizedOptionGroups.length > 0
  const generateButtonLabel =
    potentialCount > 0
      ? `Generate ${potentialCount} ${potentialCount === 1 ? 'variant' : 'variants'}`
      : 'Generate variants'

  return (
    <Section title="Variants">
      <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-neutral-200">
        <input
          type="checkbox"
          checked={form.hasVariants}
          onChange={(event) =>
            setForm({
              ...form,
              hasVariants: event.target.checked,
              optionGroups:
                event.target.checked && form.optionGroups.length === 0
                  ? [
                      {
                        id: createLocalId('option'),
                        name: 'Flavor',
                        values: [
                          { id: createLocalId('value'), value: 'Original' },
                          { id: createLocalId('value'), value: 'Berry' },
                        ],
                      },
                    ]
                  : form.optionGroups,
            })
          }
        />
        This product has variants
      </label>
      {form.hasVariants ? (
        <div className="mt-3 space-y-3">
          <p className="text-neutral-text-secondary text-xs">
            Add up to {COMMERCE_PRODUCT_VARIANT_LIMITS.maxOptionGroups} option
            groups. Generated combinations are limited to{' '}
            {COMMERCE_PRODUCT_VARIANT_LIMITS.maxVariants} variants.
          </p>
          <div className="space-y-3">
            {optionGroups.map((group, groupIndex) => (
              <div
                key={group.id}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={`Option ${groupIndex + 1} name`}>
                    <Input
                      value={group.name}
                      onChange={(event) =>
                        updateOptionGroup(group.id, {
                          name: event.target.value,
                        })
                      }
                      placeholder="Flavor"
                      aria-label={`Option ${groupIndex + 1} name`}
                    />
                  </Field>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!confirmVariantStructureChange()) return
                      setForm({
                        ...form,
                        variantsGenerated: false,
                        optionGroups: optionGroups.filter(
                          (option) => option.id !== group.id,
                        ),
                      })
                    }}
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    aria-label={`Remove option ${group.name || groupIndex + 1}`}
                  >
                    Remove option
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.values.map((entry) => (
                    <label
                      key={entry.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-neutral-200"
                    >
                      <span className="sr-only">
                        {group.name || 'Option'} value
                      </span>
                      <input
                        value={entry.value}
                        onChange={(event) =>
                          updateOptionValue(
                            group.id,
                            entry.id,
                            event.target.value,
                          )
                        }
                        className="placeholder:text-neutral-text-secondary w-24 bg-transparent outline-none"
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirmVariantStructureChange()) return
                          updateOptionGroup(group.id, {
                            values: group.values.filter(
                              (value) => value.id !== entry.id,
                            ),
                          })
                        }}
                        className="text-neutral-text-secondary rounded-full p-0.5 hover:bg-white/10 hover:text-white"
                        aria-label={`Remove value ${entry.value || 'blank'}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateOptionGroup(group.id, {
                        values: [
                          ...group.values,
                          { id: createLocalId('value'), value: '' },
                        ],
                      })
                    }
                    className="rounded-full border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1 text-xs font-medium text-cyan-100 hover:bg-cyan-300/[0.12]"
                  >
                    + Add value
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                optionGroups.length >=
                COMMERCE_PRODUCT_VARIANT_LIMITS.maxOptionGroups
              }
              onClick={() =>
                setForm({
                  ...form,
                  variantsGenerated: false,
                  optionGroups: [
                    ...optionGroups,
                    {
                      id: createLocalId('option'),
                      name: '',
                      values: [{ id: createLocalId('value'), value: '' }],
                    },
                  ],
                })
              }
            >
              Add another option
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={generate}
              disabled={!canGenerateVariants}
            >
              {generateButtonLabel}
            </Button>
            {generatedCount ? (
              <Badge variant={form.variantsGenerated ? 'green' : 'orange'}>
                {form.variantsGenerated
                  ? `${generatedCount} generated`
                  : 'Regenerate before saving'}
              </Badge>
            ) : null}
          </div>
          {localError || error ? (
            <p className="text-xs text-rose-300">{localError ?? error}</p>
          ) : null}
          {form.variantsGenerated && form.variants.length ? (
            <div className="space-y-3">
              {form.variants.map((variant, index) => (
                <div
                  key={variant.id}
                  className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="min-w-[180px] flex-[1_1_220px]">
                    <Field label="Variant">
                      <Input
                        value={variant.name}
                        onChange={(event) =>
                          updateVariant(form, setForm, index, {
                            name: event.target.value,
                          })
                        }
                        aria-label="Variant name"
                      />
                    </Field>
                  </div>
                  <div className="min-w-[140px] flex-[1_1_160px]">
                    <Field label="SKU">
                      <Input
                        value={variant.sku ?? ''}
                        onChange={(event) =>
                          updateVariant(form, setForm, index, {
                            sku: event.target.value,
                          })
                        }
                        placeholder="Variant SKU"
                        aria-label="Variant SKU"
                      />
                    </Field>
                  </div>
                  <div className="min-w-[120px] flex-[1_1_140px]">
                    <Field label="Price override">
                      <Input
                        type="number"
                        {...commerceNumericInputRules.money}
                        value={variant.price?.amount ?? ''}
                        onChange={(event) =>
                          updateVariant(form, setForm, index, {
                            price:
                              event.target.value === ''
                                ? undefined
                                : {
                                    amount: Number(event.target.value),
                                    currency: form.currency,
                                  },
                          })
                        }
                        placeholder="Price"
                        aria-label="Variant price"
                      />
                      <p className="text-neutral-text-secondary mt-1 text-[10px]">
                        Blank uses base price.
                      </p>
                    </Field>
                  </div>
                  <div className="min-w-[120px] flex-[1_1_140px]">
                    <Field label="Cost override">
                      <Input
                        type="number"
                        {...commerceNumericInputRules.money}
                        value={variant.cost?.amount ?? ''}
                        onChange={(event) =>
                          updateVariant(form, setForm, index, {
                            cost:
                              event.target.value === ''
                                ? undefined
                                : {
                                    amount: Number(event.target.value),
                                    currency: form.currency,
                                  },
                          })
                        }
                        placeholder="Cost"
                        aria-label="Variant cost"
                      />
                      <p className="text-neutral-text-secondary mt-1 text-[10px]">
                        Blank uses base cost.
                      </p>
                    </Field>
                  </div>
                  <div className="min-w-[110px] flex-[1_1_125px]">
                    <Field label="Inventory">
                      <Input
                        type="number"
                        {...commerceNumericInputRules.inventory}
                        value={variant.inventoryQuantity ?? ''}
                        onChange={(event) =>
                          updateVariant(form, setForm, index, {
                            inventoryQuantity:
                              event.target.value === ''
                                ? undefined
                                : Number(event.target.value),
                          })
                        }
                        placeholder="#"
                        aria-label="Variant inventory"
                      />
                      <p className="text-neutral-text-secondary mt-1 text-[10px]">
                        Blank if not tracked.
                      </p>
                    </Field>
                  </div>
                  <div className="min-w-[132px] flex-[1_1_150px]">
                    <Field label="Status">
                      <Select
                        value={variant.status}
                        onChange={(event) =>
                          updateVariant(form, setForm, index, {
                            status: event.target.value as CommerceProductStatus,
                          })
                        }
                        aria-label="Variant status"
                      >
                        {COMMERCE_PRODUCT_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="flex shrink-0 self-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm({
                          ...form,
                          variants: form.variants.filter((_, i) => i !== index),
                        })
                      }
                      aria-label={`Remove variant ${variant.name}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Section>
  )
}

function updateVariant(
  form: ProductFormState,
  setForm: (form: ProductFormState) => void,
  index: number,
  changes: Partial<CommerceProductVariant>,
) {
  setForm({
    ...form,
    variants: form.variants.map((variant, variantIndex) =>
      variantIndex === index ? { ...variant, ...changes } : variant,
    ),
  })
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
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block space-y-1 text-xs">
      <span className="font-medium text-neutral-200">
        {label}
        {required ? <span className="text-rose-300"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

function DescriptionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-sm md:grid-cols-[160px_1fr]">
      <dt className="text-neutral-text-secondary">{label}</dt>
      <dd className="text-neutral-100">{value}</dd>
    </div>
  )
}
