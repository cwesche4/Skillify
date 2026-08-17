import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CommerceCustomersPage } from '@/components/commerce/CommerceCustomersPage'
import {
  createPreviewCustomer,
  createPreviewFulfillment,
  createPreviewOrder,
  getCommercePreviewStorageKey,
  getPreviewCustomers,
  normalizePreviewProduct,
} from '@/lib/commerce/previewCommerceStorage'
import {
  archivePreviewCustomerType,
  getPreviewCustomerTypes,
} from '@/lib/commerce/previewCommerceCustomerTypeStorage'
import {
  archivePreviewCustomerTag,
  createPreviewCustomerTag,
  getPreviewCustomerTags,
} from '@/lib/commerce/previewCommerceTagStorage'
import type { CommerceProduct } from '@/lib/commerce/types'

const workspaceId = 'commerce-customers-page-workspace'

function product(input: Partial<CommerceProduct> = {}) {
  return normalizePreviewProduct(
    {
      id: input.id ?? 'product-kit',
      workspaceId,
      name: input.name ?? 'Maintenance Kit',
      status: input.status ?? 'ACTIVE',
      price: input.price ?? { amount: 500, currency: 'USD' },
      taxable: true,
      trackInventory: true,
      inventoryQuantity: 10,
      hasVariants: false,
      variants: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...input,
    },
    workspaceId,
  )
}

function seedProducts(products: CommerceProduct[]) {
  window.localStorage.setItem(
    getCommercePreviewStorageKey({ workspaceId, collection: 'products' }),
    JSON.stringify({
      version: 1,
      workspaceId,
      records: products,
    }),
  )
}

function seedCommerceCustomer({
  name = 'Corbin Wesche',
  email = 'corbin@example.com',
  status = 'ACTIVE',
}: {
  name?: string
  email?: string
  status?: Parameters<
    typeof createPreviewCustomer
  >[0]['input']['lifecycleStatus']
} = {}) {
  const customer = createPreviewCustomer({
    workspaceId,
    input: {
      displayName: name,
      companyName: 'NorthStar Electric',
      email,
      phone: '+1 555 0100',
      lifecycleStatus: status,
      tags: ['VIP', 'repeat'],
      billingAddress: {
        line1: '100 Main St',
        city: 'Richmond',
        region: 'VA',
        postalCode: '23220',
        country: 'US',
      },
      shippingAddress: {
        line1: '200 Warehouse Way',
        city: 'Richmond',
        region: 'VA',
        postalCode: '23221',
        country: 'US',
      },
      defaultShippingAddress: 'SHIPPING',
    },
  }).customer!
  const seededProduct = product()
  seedProducts([seededProduct])
  const order = createPreviewOrder({
    workspaceId,
    input: {
      customerId: customer.id,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'DELIVERED',
      lines: [
        {
          productId: seededProduct.id,
          name: seededProduct.name,
          quantity: 2,
          unitPrice: 500,
          unitCost: 200,
          discountTotal: 0,
          taxTotal: 0,
        },
      ],
    },
  }).order!
  const fulfillment = createPreviewFulfillment({
    workspaceId,
    input: { orderId: order.id, status: 'DELIVERED' },
  }).fulfillment!

  return { customer, order, fulfillment, product: seededProduct }
}

function tableBody() {
  return screen.getAllByRole('rowgroup')[1]!
}

describe('CommerceCustomersPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.pushState({}, '', '/dashboard/northstar/customers')
  })

  it('creates a customer and opens the customer drawer', async () => {
    const user = userEvent.setup()
    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(
      screen.getAllByRole('button', { name: 'Create Customer' })[0]!,
    )
    await user.type(screen.getByLabelText(/Name/), 'Avery Buyer')
    await user.type(screen.getByLabelText(/Email/), 'avery@example.com')
    await user.click(screen.getByRole('button', { name: 'Save Customer' }))

    await waitFor(() => {
      expect(
        screen.getByRole('dialog', { name: 'Customer Avery Buyer' }),
      ).toBeTruthy()
    })
    expect(screen.getAllByText('Avery Buyer').length).toBeGreaterThanOrEqual(1)
    expect(within(tableBody()).getByText('avery@example.com')).toBeTruthy()
  })

  it('keeps KPI cards and quick filters synchronized with the customer table', async () => {
    const user = userEvent.setup()
    seedCommerceCustomer({ name: 'Corbin Wesche', status: 'ACTIVE' })
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Inactive Buyer',
        email: 'inactive@example.com',
        lifecycleStatus: 'INACTIVE',
      },
    })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(
      screen.getByRole('button', {
        name: 'Show high lifetime value customers',
      }),
    )
    expect(
      screen
        .getByRole('button', { name: 'Show high lifetime value customers' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(within(tableBody()).getByText('Corbin Wesche')).toBeTruthy()
    expect(within(tableBody()).queryByText('Inactive Buyer')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Inactive' }))
    expect(within(tableBody()).getByText('Inactive Buyer')).toBeTruthy()
    expect(within(tableBody()).queryByText('Corbin Wesche')).toBeNull()
  })

  it('opens a customer row with mouse and keyboard and shows drawer sections', async () => {
    const user = userEvent.setup()
    const { customer } = seedCommerceCustomer()

    render(<CommerceCustomersPage workspaceId={workspaceId} />)
    const row = screen.getByRole('button', {
      name: `Open customer ${customer.displayName}`,
    })
    row.focus()
    await user.keyboard('{Enter}')

    const drawer = screen.getByRole('dialog', {
      name: `Customer ${customer.displayName}`,
    })
    expect(
      within(drawer).getByRole('heading', { name: 'Customer Details' }),
    ).toBeTruthy()
    expect(
      within(drawer).getByRole('heading', { name: 'Addresses' }),
    ).toBeTruthy()
    expect(
      within(drawer).getByRole('heading', { name: 'Commerce Metrics' }),
    ).toBeTruthy()
    expect(
      within(drawer).getByRole('heading', { name: 'Connected Records' }),
    ).toBeTruthy()
    expect(
      within(drawer).getByRole('heading', { name: 'Timeline' }),
    ).toBeTruthy()
    expect(
      within(drawer).getByText('Future commerce relationships'),
    ).toBeTruthy()
    expect(within(drawer).queryByText('Support Tickets')).toBeNull()

    await user.click(
      within(drawer).getByRole('button', {
        name: /Future commerce relationships/,
      }),
    )
    expect(within(drawer).getByText('Support Tickets')).toBeTruthy()
  })

  it('edits customer profile fields and persists inline notes', async () => {
    const user = userEvent.setup()
    const { customer } = seedCommerceCustomer()

    render(<CommerceCustomersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(customer.displayName))
    await user.click(screen.getByRole('button', { name: 'Edit Customer' }))

    await user.clear(screen.getByLabelText(/Company/))
    await user.type(screen.getByLabelText(/Company/), 'NorthStar Holdings')
    await user.selectOptions(
      screen.getByLabelText(/Customer Status/),
      'AT_RISK',
    )
    await user.click(
      screen.getByRole('button', { name: 'Select customer type' }),
    )
    await user.click(screen.getByRole('button', { name: /^Commercial$/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(getPreviewCustomers(workspaceId)[0]?.companyName).toBe(
        'NorthStar Holdings',
      )
    })
    expect(screen.getAllByText('At Risk').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Commercial').length).toBeGreaterThanOrEqual(1)

    await user.click(
      screen.getByRole('button', { name: 'Edit Customer Notes' }),
    )
    const noteBox = screen.getAllByRole('textbox').at(-1)!
    await user.clear(noteBox)
    await user.type(noteBox, 'Prefers delivery after 3pm.')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(getPreviewCustomers(workspaceId)[0]?.clientNotes).toBe(
      'Prefers delivery after 3pm.',
    )
  })

  it('keeps status dropdown refinements separate from quick-filter presets', async () => {
    const user = userEvent.setup()
    seedCommerceCustomer({ name: 'Corbin Wesche', status: 'ACTIVE' })
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'New Buyer',
        email: 'new@example.com',
        lifecycleStatus: 'NEW',
      },
    })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(screen.getByRole('button', { name: 'New' }))
    expect(screen.getByLabelText('Filter by status')).toHaveProperty(
      'value',
      'NEW',
    )
    expect(within(tableBody()).getByText('New Buyer')).toBeTruthy()

    await user.selectOptions(
      screen.getByLabelText('Filter by status'),
      'INACTIVE',
    )
    expect(
      screen.getByRole('button', { name: 'New' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: 'Inactive' })
        .getAttribute('aria-pressed'),
    ).toBe('false')
    expect(
      screen.getByRole('button', { name: /Clear 1 active filter/i }),
    ).toBeTruthy()
  })

  it('clears secondary customer filters while preserving the selected primary preset', async () => {
    const user = userEvent.setup()
    seedCommerceCustomer({ name: 'Corbin Wesche', status: 'ACTIVE' })
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'New Buyer',
        email: 'new@example.com',
        lifecycleStatus: 'NEW',
      },
    })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(screen.getByRole('button', { name: 'New' }))
    expect(
      screen.queryByRole('button', { name: /Clear .* active filter/i }),
    ).toBeNull()
    await user.type(screen.getByLabelText('Search customers'), 'missing')
    expect(
      screen.getByRole('button', { name: /Clear 1 active filter/i }),
    ).toBeTruthy()

    await user.click(
      screen.getByRole('button', { name: /Clear 1 active filter/i }),
    )
    expect(
      screen.queryByRole('button', { name: /Clear .* active filter/i }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'New' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(screen.getByLabelText('Filter by status')).toHaveProperty(
      'value',
      'NEW',
    )
    expect(within(tableBody()).getByText('New Buyer')).toBeTruthy()
    expect(within(tableBody()).queryByText('Corbin Wesche')).toBeNull()
  })

  it('shows a usable tag management action when no tags exist', async () => {
    const user = userEvent.setup()
    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    const filter = screen.getByRole('button', { name: 'Filter by tags' })
    expect(filter.textContent).toContain('All tags')
    expect(screen.queryByRole('button', { name: 'Manage' })).toBeNull()

    await user.click(filter)
    expect(screen.getByText('No tags created')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Manage tags' }))
    expect(screen.getByRole('dialog', { name: 'Manage tags' })).toBeTruthy()
  })

  it('keeps the tag filter selected when opening tag management from the dropdown', async () => {
    const user = userEvent.setup()
    const tag = createPreviewCustomerTag({
      workspaceId,
      label: 'Wholesale',
    }).tag!
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Tagged Filter Buyer',
        email: 'tag-filter@example.com',
        tags: [tag.id],
      },
    })
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Other Buyer',
        email: 'other-filter@example.com',
      },
    })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(screen.getByRole('button', { name: 'Filter by tags' }))
    await user.click(
      within(screen.getByRole('listbox', { name: 'Filter by tags' })).getByRole(
        'option',
        { name: /Wholesale/ },
      ),
    )
    expect(
      screen.getByRole('button', { name: 'Filter by tags' }).textContent,
    ).toContain('Wholesale')
    expect(within(tableBody()).getByText('Tagged Filter Buyer')).toBeTruthy()
    expect(within(tableBody()).queryByText('Other Buyer')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Filter by tags' }))
    await user.click(screen.getByRole('button', { name: 'Manage tags' }))
    expect(screen.getByRole('dialog', { name: 'Manage tags' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Filter by tags' }).textContent,
    ).toContain('Wholesale')
  })

  it('preserves archived customer type references and keeps the current archived type editable', async () => {
    const user = userEvent.setup()
    const commercialType = getPreviewCustomerTypes(workspaceId).find(
      (type) => type.name === 'Commercial',
    )!
    const customer = createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Archived Type Buyer',
        email: 'archived-type@example.com',
        customerTypeId: commercialType.id,
      },
    }).customer!
    archivePreviewCustomerType({ workspaceId, typeId: commercialType.id })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    expect(
      Array.from(
        screen
          .getByLabelText('Filter by customer type')
          .querySelectorAll('option'),
      ).map((option) => option.textContent),
    ).not.toContain('Commercial')

    await user.click(screen.getByText(customer.displayName))
    const drawer = screen.getByRole('dialog', {
      name: `Customer ${customer.displayName}`,
    })
    expect(within(drawer).getByText('Commercial · Archived')).toBeTruthy()

    await user.click(
      within(drawer).getByRole('button', { name: 'Edit Customer' }),
    )
    expect(
      within(drawer).getByRole('button', { name: 'Select customer type' })
        .textContent,
    ).toContain('Commercial · Archived')
  })

  it('selects customer rows with shared bulk checkboxes without opening drawers', async () => {
    const user = userEvent.setup()
    seedCommerceCustomer({ name: 'Corbin Wesche', status: 'ACTIVE' })
    createPreviewCustomer({
      workspaceId,
      input: { displayName: 'Avery Buyer', email: 'avery-buyer@example.com' },
    })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(screen.getByLabelText('Select customer Corbin Wesche'))
    expect(
      screen.queryByRole('dialog', { name: 'Customer Corbin Wesche' }),
    ).toBeNull()
    expect(screen.getByText('1 customer selected')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Add Tags' }).className,
    ).toContain('bg-brand-primary')
    expect(
      screen.getByRole('button', { name: 'Change Type' }).className,
    ).toContain('bg-app-surface-raised')
    expect(screen.getByRole('button', { name: 'Archive' }).className).toContain(
      'bg-rose-600',
    )

    await user.click(screen.getByLabelText('Select all visible records'))
    expect(screen.getByText('2 customers selected')).toBeTruthy()
  })

  it('uses singular and plural archive confirmation labels for bulk archive', async () => {
    const user = userEvent.setup()
    const { customer } = seedCommerceCustomer({
      name: 'Corbin Wesche',
      status: 'ACTIVE',
    })
    const second = createPreviewCustomer({
      workspaceId,
      input: { displayName: 'Avery Buyer', email: 'avery-archive@example.com' },
    }).customer!

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(
      screen.getByLabelText(`Select customer ${customer.displayName}`),
    )
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    const singleDialog = screen.getByRole('dialog', {
      name: 'Archive customer',
    })
    expect(
      within(singleDialog).getByText(/Archive the selected customer/),
    ).toBeTruthy()
    expect(
      within(singleDialog).getByRole('button', { name: 'Archive Customer' }),
    ).toBeTruthy()
    await user.click(
      within(singleDialog).getByRole('button', { name: 'Cancel' }),
    )
    expect(
      getPreviewCustomers(workspaceId).find(
        (record) => record.id === customer.id,
      )?.lifecycleStatus,
    ).toBe('ACTIVE')

    await user.click(
      screen.getByLabelText(`Select customer ${second.displayName}`),
    )
    expect(screen.getByText('2 customers selected')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    const pluralDialog = screen.getByRole('dialog', {
      name: 'Archive customers',
    })
    expect(
      within(pluralDialog).getByText(/Archive 2 selected customers/),
    ).toBeTruthy()
    await user.click(
      within(pluralDialog).getByRole('button', { name: 'Archive Customers' }),
    )

    await waitFor(() => {
      const archived = getPreviewCustomers(workspaceId).filter((record) =>
        [customer.id, second.id].includes(record.id),
      )
      expect(
        archived.every((record) => record.lifecycleStatus === 'INACTIVE'),
      ).toBe(true)
    })
  })

  it('renders the bulk More menu in a portal and closes it safely', async () => {
    const user = userEvent.setup()
    const { customer } = seedCommerceCustomer({
      name: 'Corbin Wesche',
      status: 'ACTIVE',
    })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(
      screen.getByLabelText(`Select customer ${customer.displayName}`),
    )
    await user.click(screen.getByRole('button', { name: 'More' }))

    const menu = screen.getByRole('menu', { name: 'More bulk actions' })
    expect(menu.parentElement).toBe(document.body)
    expect(
      within(menu).getByRole('menuitem', { name: 'Remove Tags' }),
    ).toBeTruthy()
    expect(
      within(menu).getByRole('menuitem', { name: 'Change Status' }),
    ).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: 'Export' })).toBeTruthy()
    expect(screen.getByText('1 customer selected')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(
        screen.queryByRole('menu', { name: 'More bulk actions' }),
      ).toBeNull()
    })
    expect(screen.getByText('1 customer selected')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.mouseDown(document.body)
    await waitFor(() => {
      expect(
        screen.queryByRole('menu', { name: 'More bulk actions' }),
      ).toBeNull()
    })
    expect(screen.getByText('1 customer selected')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Export',
      }),
    )
    expect(screen.queryByRole('menu', { name: 'More bulk actions' })).toBeNull()
    expect(
      screen.getByRole('dialog', { name: 'Export customers' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('dialog', { name: 'Customer Corbin Wesche' }),
    ).toBeNull()
  })

  it('bulk adds selected workspace tags to selected customers', async () => {
    const user = userEvent.setup()
    const { customer } = seedCommerceCustomer({
      name: 'Corbin Wesche',
      status: 'ACTIVE',
    })
    const second = createPreviewCustomer({
      workspaceId,
      input: { displayName: 'Avery Buyer', email: 'avery-bulk@example.com' },
    }).customer!
    const wholesale = createPreviewCustomerTag({
      workspaceId,
      label: 'Wholesale',
    }).tag!
    const local = createPreviewCustomerTag({
      workspaceId,
      label: 'Local Buyer',
    }).tag!
    const archived = createPreviewCustomerTag({
      workspaceId,
      label: 'Dormant',
    }).tag!
    archivePreviewCustomerTag({ workspaceId, tagId: archived.id })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)
    const initialCustomerTags =
      getPreviewCustomers(workspaceId).find(
        (record) => record.id === customer.id,
      )?.tags ?? []

    await user.click(
      screen.getByLabelText(`Select customer ${customer.displayName}`),
    )
    await user.click(
      screen.getByLabelText(`Select customer ${second.displayName}`),
    )
    await user.click(screen.getByRole('button', { name: 'Add Tags' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add tags' })
    expect(within(dialog).getByText('2 selected customers')).toBeTruthy()
    expect(
      within(dialog).getByRole('option', { name: /Wholesale/ }),
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('option', { name: /Local Buyer/ }),
    ).toBeTruthy()
    expect(within(dialog).queryByRole('option', { name: /Dormant/ })).toBeNull()
    expect(
      within(dialog).getByRole<HTMLButtonElement>('button', {
        name: 'Add Tags',
      }).disabled,
    ).toBe(true)

    await user.click(within(dialog).getByRole('option', { name: /Wholesale/ }))
    await user.click(
      within(dialog).getByRole('option', { name: /Local Buyer/ }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Remove Local Buyer tag' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Add Tags' }))

    await waitFor(() => {
      expect(
        getPreviewCustomers(workspaceId).find(
          (record) => record.id === second.id,
        )?.tags,
      ).toContain(wholesale.id)
    })
    const updated = getPreviewCustomers(workspaceId).filter((record) =>
      [customer.id, second.id].includes(record.id),
    )
    expect(updated.every((record) => record.tags?.includes(wholesale.id))).toBe(
      true,
    )
    expect(updated.every((record) => !record.tags?.includes(local.id))).toBe(
      true,
    )
    expect(
      initialCustomerTags.every((tagId) =>
        updated
          .find((record) => record.id === customer.id)
          ?.tags?.includes(tagId),
      ),
    ).toBe(true)
  })

  it('bulk creates a new tag only through the explicit create action', async () => {
    const user = userEvent.setup()
    const { customer } = seedCommerceCustomer({
      name: 'Corbin Wesche',
      status: 'ACTIVE',
    })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(
      screen.getByLabelText(`Select customer ${customer.displayName}`),
    )
    await user.click(screen.getByRole('button', { name: 'Add Tags' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add tags' })

    await user.type(
      within(dialog).getByLabelText('Search customer tags'),
      'Bulk Segment',
    )
    expect(
      getPreviewCustomerTags(workspaceId).some(
        (tag) => tag.label === 'Bulk Segment',
      ),
    ).toBe(false)
    await user.click(
      within(dialog).getByRole('button', { name: /Create tag “Bulk Segment”/ }),
    )
    const created = getPreviewCustomerTags(workspaceId).find(
      (tag) => tag.label === 'Bulk Segment',
    )
    expect(created?.status).toBe('active')
    await user.click(within(dialog).getByRole('button', { name: 'Add Tags' }))

    await waitFor(() => {
      expect(getPreviewCustomers(workspaceId)[0]?.tags).toContain(created?.id)
    })
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Filter by tags' }))
    expect(
      within(screen.getByRole('listbox', { name: 'Filter by tags' })).getByRole(
        'option',
        { name: /Bulk Segment/ },
      ),
    ).toBeTruthy()
  })

  it('renders connected order, fulfillment, and product links with canonical ids', async () => {
    const user = userEvent.setup()
    const {
      customer,
      order,
      fulfillment,
      product: seededProduct,
    } = seedCommerceCustomer()

    render(<CommerceCustomersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(customer.displayName))

    expect(
      screen.getByRole('link', { name: /ORD-01001/ }).getAttribute('href'),
    ).toBe(`/dashboard/northstar/orders?orderId=${order.id}`)
    expect(
      screen.getByRole('link', { name: /Fulfillment/ }).getAttribute('href'),
    ).toBe(`/dashboard/northstar/fulfillment?fulfillmentId=${fulfillment.id}`)
    expect(
      screen
        .getByRole('link', { name: /Product Purchased/ })
        .getAttribute('href'),
    ).toBe(`/dashboard/northstar/products?productId=${seededProduct.id}`)
  })

  it('prevents duplicate customer emails inside the same workspace', async () => {
    const user = userEvent.setup()
    createPreviewCustomer({
      workspaceId,
      input: { displayName: 'Existing Buyer', email: 'duplicate@example.com' },
    })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)
    await user.click(
      screen.getAllByRole('button', { name: 'Create Customer' })[0]!,
    )
    await user.type(screen.getByLabelText(/Name/), 'Duplicate Buyer')
    await user.type(screen.getByLabelText(/Email/), 'duplicate@example.com')
    await user.click(screen.getByRole('button', { name: 'Save Customer' }))

    expect(
      screen.getByText('A customer with this email already exists.'),
    ).toBeTruthy()
    expect(getPreviewCustomers(workspaceId)).toHaveLength(1)
  })

  it('creates and assigns reusable customer tags from the customer form', async () => {
    const user = userEvent.setup()
    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(
      screen.getAllByRole('button', { name: 'Create Customer' })[0]!,
    )
    await user.type(screen.getByLabelText(/Name/), 'Tagged Buyer')
    await user.click(
      screen.getByRole('button', { name: /Select customer tags/ }),
    )
    await user.type(screen.getByPlaceholderText('Search tags...'), 'Preferred')
    await user.click(
      screen.getByRole('button', { name: /Create tag “Preferred”/ }),
    )
    await user.click(screen.getByRole('button', { name: 'Save Customer' }))

    await waitFor(() => {
      expect(
        screen.getByRole('dialog', { name: 'Customer Tagged Buyer' }),
      ).toBeTruthy()
    })
    expect(screen.getAllByText('Preferred').length).toBeGreaterThanOrEqual(1)

    await user.click(
      screen.getByRole('button', { name: 'Close customer drawer' }),
    )
    await user.click(
      screen.getAllByRole('button', { name: 'Create Customer' })[0]!,
    )
    await user.type(screen.getByLabelText(/Name/), 'Second Buyer')
    await user.click(
      screen.getByRole('button', { name: /Select customer tags/ }),
    )
    expect(screen.getByRole('button', { name: /Preferred/ })).toBeTruthy()
  })

  it('archives and deletes preview customer records', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm')
    const { customer } = seedCommerceCustomer()

    render(<CommerceCustomersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(customer.displayName))
    await user.click(screen.getByRole('button', { name: 'Archive Customer' }))
    expect(
      screen.getByRole('alertdialog', { name: 'Archive customer?' }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Archive customer' }))
    expect(getPreviewCustomers(workspaceId)[0]?.lifecycleStatus).toBe(
      'INACTIVE',
    )

    await user.click(
      screen.getByRole('button', { name: 'Delete Preview Record' }),
    )
    expect(
      screen.getByRole('alertdialog', { name: 'Delete preview customer?' }),
    ).toBeTruthy()
    expect(
      screen.getByText(/Delete Corbin Wesche from this preview workspace/),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(getPreviewCustomers(workspaceId)).toHaveLength(1)

    await user.click(
      screen.getByRole('button', { name: 'Delete Preview Record' }),
    )
    await user.click(screen.getByRole('button', { name: 'Delete customer' }))
    expect(getPreviewCustomers(workspaceId)).toHaveLength(0)
    expect(
      screen.queryByRole('dialog', {
        name: `Customer ${customer.displayName}`,
      }),
    ).toBeNull()
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('confirms permanent customer tag and type deletion without native dialogs', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm')
    createPreviewCustomerTag({ workspaceId, label: 'Temporary' })

    render(<CommerceCustomersPage workspaceId={workspaceId} />)

    await user.click(screen.getByRole('button', { name: 'Filter by tags' }))
    await user.click(screen.getByRole('button', { name: 'Manage tags' }))
    const tagsDialog = screen.getByRole('dialog', { name: 'Manage tags' })
    await user.click(
      within(tagsDialog).getAllByRole('button', { name: 'Delete unused' })[0]!,
    )
    const tagConfirm = screen.getByRole('alertdialog', {
      name: 'Delete customer tag?',
    })
    expect(tagConfirm).toBeTruthy()
    expect(within(tagConfirm).getByText(/Temporary/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      getPreviewCustomerTags(workspaceId).some(
        (tag) => tag.label === 'Temporary',
      ),
    ).toBe(true)

    await user.click(
      within(tagsDialog).getAllByRole('button', { name: 'Delete unused' })[0]!,
    )
    await user.click(screen.getByRole('button', { name: 'Delete tag' }))
    expect(
      getPreviewCustomerTags(workspaceId).some(
        (tag) => tag.label === 'Temporary',
      ),
    ).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Close Manage tags' }))
    await user.click(
      screen.getAllByRole('button', { name: 'Create Customer' })[0]!,
    )
    await user.click(
      screen.getByRole('button', { name: 'Select customer type' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Manage customer types' }),
    )
    const typesDialog = screen.getByRole('dialog', {
      name: 'Manage customer types',
    })
    await user.click(
      within(typesDialog).getAllByRole('button', { name: 'Delete unused' })[0]!,
    )
    expect(
      screen.getByRole('alertdialog', { name: 'Delete customer type?' }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Delete type' }))
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('closes the customer drawer with X, backdrop, and Escape', async () => {
    const user = userEvent.setup()
    const { customer } = seedCommerceCustomer()

    render(<CommerceCustomersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(customer.displayName))
    expect(
      screen.getByRole('dialog', { name: `Customer ${customer.displayName}` }),
    ).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Close customer drawer' }),
    )
    expect(
      screen.queryByRole('dialog', {
        name: `Customer ${customer.displayName}`,
      }),
    ).toBeNull()

    await user.click(screen.getByText(customer.displayName))
    const drawer = screen.getByRole('dialog', {
      name: `Customer ${customer.displayName}`,
    })
    fireEvent.mouseDown(drawer.parentElement!)
    expect(
      screen.queryByRole('dialog', {
        name: `Customer ${customer.displayName}`,
      }),
    ).toBeNull()

    await user.click(screen.getByText(customer.displayName))
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', {
        name: `Customer ${customer.displayName}`,
      }),
    ).toBeNull()
  })
})
