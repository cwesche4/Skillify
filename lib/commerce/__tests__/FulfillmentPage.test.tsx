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

import { FulfillmentPage } from '@/components/commerce/FulfillmentPage'
import {
  createPreviewCustomer,
  createPreviewFulfillment,
  createPreviewOrder,
  getPreviewCustomers,
  getPreviewFulfillmentActivities,
  getPreviewFulfillments,
  normalizePreviewFulfillment,
  normalizePreviewProduct,
  getCommercePreviewStorageKey,
} from '@/lib/commerce/previewCommerceStorage'
import type { CommerceOrder, CommerceProduct } from '@/lib/commerce/types'

const workspaceId = 'fulfillment-page-workspace'

function product(input: Partial<CommerceProduct>) {
  return normalizePreviewProduct(
    {
      id: input.id ?? 'product-kit',
      workspaceId,
      name: input.name ?? 'Maintenance Kit',
      status: input.status ?? 'ACTIVE',
      price: input.price ?? { amount: 125, currency: 'USD' },
      cost: input.cost ?? { amount: 70, currency: 'USD' },
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

function seedOrder({
  customerName = 'NorthStar Electric',
}: {
  customerName?: string
} = {}): CommerceOrder {
  const seededProduct = product({ name: 'Maintenance Kit' })
  seedProducts([seededProduct])
  const emailSlug = customerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const customer = createPreviewCustomer({
    workspaceId,
    input: {
      displayName: customerName,
      email: `${emailSlug}@northstar.example`,
      phone: '+1 555 0100',
    },
  }).customer!
  return createPreviewOrder({
    workspaceId,
    input: {
      customerId: customer.id,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED',
      shippingMethod: 'Ground',
      shippingCarrier: 'UPS',
      trackingNumber: '1Z999',
      shippingCharge: 15,
      shippingCost: 10,
      shippingPayer: 'CUSTOMER',
      customerNotesSnapshot: 'Leave at front desk.',
      lines: [
        {
          productId: seededProduct.id,
          name: seededProduct.name,
          sku: 'KIT-001',
          quantity: 2,
          unitPrice: 125,
          unitCost: 70,
        },
      ],
    },
  }).order!
}

function tableBody() {
  return screen.getAllByRole('rowgroup')[1]!
}

describe('FulfillmentPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.pushState({}, '', '/dashboard/northstar/fulfillment')
  })

  it('clears secondary fulfillment filters from the primary chip row', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id, status: 'UNFULFILLED', carrier: 'UPS' },
    })

    render(<FulfillmentPage workspaceId={workspaceId} />)

    await user.type(
      screen.getByPlaceholderText(
        'Search fulfillment, order, customer, tracking...',
      ),
      'missing',
    )
    expect(
      screen.getByRole('button', { name: /Clear 1 active filter/i }),
    ).toBeTruthy()
    expect(within(tableBody()).queryByText('NorthStar Electric')).toBeNull()

    await user.click(
      screen.getByRole('button', { name: /Clear 1 active filter/i }),
    )
    expect(
      screen.queryByRole('button', { name: /Clear .* active filter/i }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'All Fulfillments' }).className,
    ).toContain('text-cyan-100')
    expect(within(tableBody()).getByText('NorthStar Electric')).toBeTruthy()
  })

  it('creates a fulfillment from an order and opens the drawer', async () => {
    const user = userEvent.setup()
    const order = seedOrder()

    render(<FulfillmentPage workspaceId={workspaceId} />)

    await user.click(
      screen.getAllByRole('button', { name: 'Create Fulfillment' })[0]!,
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Order/ }),
      order.id,
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Priority/ }),
      'HIGH',
    )
    await user.click(
      screen.getAllByRole('button', { name: 'Create Fulfillment' }).at(-1)!,
    )

    await waitFor(() => {
      expect(screen.getAllByText('FUL-01001').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText('FULFILLMENT')).toBeTruthy()
    expect(
      screen.getAllByText('NorthStar Electric').length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Qty Ordered: 2')).toBeTruthy()
  })

  it('keeps KPI cards and filter chips synchronized', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)

    expect(
      within(tableBody()).getByText(fulfillment.fulfillmentNumber),
    ).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Show waiting fulfillments' }),
    )
    expect(
      screen
        .getByRole('button', { name: 'Show waiting fulfillments' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      within(tableBody()).getByText(fulfillment.fulfillmentNumber),
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'In Progress' }))
    expect(
      screen.getByRole('button', { name: 'In Progress' }).className,
    ).toContain('border-cyan')
    expect(
      within(tableBody()).queryByText(fulfillment.fulfillmentNumber),
    ).toBeNull()
  })

  it('clicking a fulfillment row opens the matching drawer from preview storage', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(
      within(tableBody()).getByText(fulfillment.fulfillmentNumber),
    )

    expect(
      screen.getByRole('dialog', {
        name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
      }),
    ).toBeTruthy()
    const drawer = screen.getByRole('dialog', {
      name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
    })
    expect(drawer.parentElement?.getAttribute('style')).toContain(
      '--dashboard-top-bar-height',
    )
    expect(drawer.className).toContain('h-full')
    expect(
      screen.getAllByText(fulfillment.fulfillmentNumber).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('shows compact fulfillment, order, customer, and status context in the sticky header', async () => {
    const user = userEvent.setup()
    const order = seedOrder({
      customerName:
        'NorthStar Electric Commercial Preventive Maintenance Division With A Very Long Name',
    })
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: {
        orderId: order.id,
        fulfillmentNumber: 'FUL-01001',
        status: 'SHIPPED',
      },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(within(tableBody()).getByText('FUL-01001'))

    const drawer = screen.getByRole('dialog', { name: 'Fulfillment FUL-01001' })
    expect(within(drawer).getByText('FULFILLMENT')).toBeTruthy()
    expect(
      within(drawer).getByRole('heading', { name: 'FUL-01001' }),
    ).toBeTruthy()
    expect(
      within(drawer).getByText(
        `Order ${order.orderNumber} · NorthStar Electric Commercial Preventive Maintenance Division With A Very Long Name`,
      ),
    ).toBeTruthy()
    expect(
      within(drawer).getAllByText('Shipped').length,
    ).toBeGreaterThanOrEqual(1)
    expect(within(drawer).getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(
      within(drawer).getByRole('button', { name: 'Close fulfillment drawer' }),
    ).toBeTruthy()
  })

  it('opens a visible fulfillment row when stored preview data has a blank fulfillment id', async () => {
    const user = userEvent.setup()
    const order = seedOrder({ customerName: 'Corbin Wesche' })
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: {
        orderId: order.id,
        fulfillmentNumber: 'FUL-01001',
        status: 'SHIPPED',
      },
    }).fulfillment!

    window.localStorage.setItem(
      getCommercePreviewStorageKey({ workspaceId, collection: 'fulfillments' }),
      JSON.stringify({
        version: 1,
        workspaceId,
        records: [{ ...fulfillment, id: '' }],
      }),
    )

    render(<FulfillmentPage workspaceId={workspaceId} />)

    const row = screen.getByRole('button', {
      name: 'Open fulfillment FUL-01001',
    })
    expect(row.getAttribute('data-fulfillment-id')).toMatch(/^ful_ful-01001-/)
    const migratedPayload = JSON.parse(
      window.localStorage.getItem(
        getCommercePreviewStorageKey({
          workspaceId,
          collection: 'fulfillments',
        }),
      ) ?? '{}',
    )
    expect(migratedPayload.records[0].id).toBe(
      row.getAttribute('data-fulfillment-id'),
    )

    await user.click(within(tableBody()).getByText('FUL-01001'))

    const drawer = screen.getByRole('dialog', { name: 'Fulfillment FUL-01001' })
    expect(drawer).toBeTruthy()
    expect(
      within(drawer).getAllByText('ORD-01001').length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Corbin Wesche').length).toBeGreaterThanOrEqual(
      1,
    )
  })

  it('opens the fulfillment drawer from order and status cells', async () => {
    const user = userEvent.setup()
    const order = seedOrder({ customerName: 'Corbin Wesche' })
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: {
        orderId: order.id,
        fulfillmentNumber: 'FUL-01001',
        status: 'SHIPPED',
      },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)

    await user.click(within(tableBody()).getByText(order.orderNumber))
    expect(
      screen.getByRole('dialog', {
        name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
      }),
    ).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Close fulfillment drawer' }),
    )

    await user.click(within(tableBody()).getByText('Shipped'))
    expect(
      screen.getByRole('dialog', {
        name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
      }),
    ).toBeTruthy()
  })

  it('clicking a different fulfillment row opens the correct record', async () => {
    const user = userEvent.setup()
    const firstOrder = seedOrder()
    const secondOrder = seedOrder({ customerName: 'Bright Path Plumbing' })
    const firstFulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: firstOrder.id },
    }).fulfillment!
    const secondFulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: secondOrder.id, assignedTo: 'Field Team' },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(
      within(tableBody()).getByText(firstFulfillment.fulfillmentNumber),
    )
    expect(
      screen.getByRole('dialog', {
        name: `Fulfillment ${firstFulfillment.fulfillmentNumber}`,
      }),
    ).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Close fulfillment drawer' }),
    )

    await user.click(
      within(tableBody()).getByText(secondFulfillment.fulfillmentNumber),
    )
    expect(
      screen.getByRole('dialog', {
        name: `Fulfillment ${secondFulfillment.fulfillmentNumber}`,
      }),
    ).toBeTruthy()
    expect(
      screen.getAllByText('Bright Path Plumbing').length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.queryByRole('dialog', {
        name: `Fulfillment ${firstFulfillment.fulfillmentNumber}`,
      }),
    ).toBeNull()
  })

  it('opens a focused fulfillment row with Enter and Space', async () => {
    const user = userEvent.setup()
    const firstOrder = seedOrder()
    const secondOrder = seedOrder({ customerName: 'Bright Path Plumbing' })
    const firstFulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: firstOrder.id },
    }).fulfillment!
    const secondFulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: secondOrder.id },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    const firstRow = screen.getByRole('button', {
      name: `Open fulfillment ${firstFulfillment.fulfillmentNumber}`,
    })
    firstRow.focus()
    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('dialog', {
        name: `Fulfillment ${firstFulfillment.fulfillmentNumber}`,
      }),
    ).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Close fulfillment drawer' }),
    )

    const secondRow = screen.getByRole('button', {
      name: `Open fulfillment ${secondFulfillment.fulfillmentNumber}`,
    })
    secondRow.focus()
    await user.keyboard(' ')
    expect(
      screen.getByRole('dialog', {
        name: `Fulfillment ${secondFulfillment.fulfillmentNumber}`,
      }),
    ).toBeTruthy()
  })

  it('closes the fulfillment drawer with X, backdrop, and Escape', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(
      within(tableBody()).getByText(fulfillment.fulfillmentNumber),
    )
    expect(
      screen.getByRole('dialog', {
        name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
      }),
    ).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Close fulfillment drawer' }),
    )
    expect(
      screen.queryByRole('dialog', {
        name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
      }),
    ).toBeNull()

    await user.click(
      within(tableBody()).getByText(fulfillment.fulfillmentNumber),
    )
    const dialog = screen.getByRole('dialog', {
      name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
    })
    fireEvent.mouseDown(dialog.parentElement!)
    expect(
      screen.queryByRole('dialog', {
        name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
      }),
    ).toBeNull()

    await user.click(
      within(tableBody()).getByText(fulfillment.fulfillmentNumber),
    )
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', {
        name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
      }),
    ).toBeNull()
  })

  it('filters by status, priority, assigned user, shipping method, carrier, and search', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: {
        orderId: order.id,
        priority: 'URGENT',
        assignedTo: 'Field Team',
        shippingMethod: 'Ground',
        carrier: 'UPS',
      },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)

    await user.selectOptions(
      screen.getByDisplayValue('All priorities'),
      'URGENT',
    )
    expect(
      within(tableBody()).getByText(fulfillment.fulfillmentNumber),
    ).toBeTruthy()

    await user.selectOptions(
      screen.getByDisplayValue('All assignees'),
      'Field Team',
    )
    await user.selectOptions(screen.getByDisplayValue('All methods'), 'Ground')
    await user.selectOptions(screen.getByDisplayValue('All carriers'), 'UPS')
    await user.type(screen.getByPlaceholderText(/Search fulfillment/), '1Z999')
    expect(
      within(tableBody()).getByText(fulfillment.fulfillmentNumber),
    ).toBeTruthy()

    await user.clear(screen.getByPlaceholderText(/Search fulfillment/))
    await user.selectOptions(
      screen.getByDisplayValue('All statuses'),
      'READY_TO_SHIP',
    )
    expect(
      within(tableBody()).queryByText(fulfillment.fulfillmentNumber),
    ).toBeNull()
  })

  it('updates status from the read-only drawer and writes timeline activity', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(fulfillment.fulfillmentNumber))

    await user.click(
      screen.getByRole('button', { name: 'Update fulfillment status' }),
    )
    const menu = screen.getByRole('listbox', {
      name: 'Fulfillment status options',
    })
    expect(
      within(menu).getByRole('option', { name: /Ready to Ship/ }),
    ).toBeTruthy()
    await user.click(
      within(menu).getByRole('option', { name: /Ready to Ship/ }),
    )

    expect(screen.getByText('Unsaved status changes.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(screen.getByText('Marked Ready to Ship')).toBeTruthy()
    })
    const activities = getPreviewFulfillmentActivities(
      workspaceId,
      fulfillment.id,
    )
    expect(
      activities.filter(
        (activity) => activity.title === 'Marked Ready to Ship',
      ),
    ).toHaveLength(1)
  })

  it('uses Shipping & Delivery wording in the read-only drawer', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(fulfillment.fulfillmentNumber))

    const drawer = screen.getByRole('dialog', {
      name: `Fulfillment ${fulfillment.fulfillmentNumber}`,
    })
    expect(
      within(drawer).getByRole('heading', { name: 'Shipping & Delivery' }),
    ).toBeTruthy()
    expect(
      within(drawer).queryByRole('heading', { name: 'Shipping' }),
    ).toBeNull()
  })

  it('edits assignment and tracking details in the drawer', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(fulfillment.fulfillmentNumber))
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    await user.selectOptions(
      screen.getByRole('combobox', { name: /Assigned To/ }),
      'Field Team',
    )
    await user.clear(screen.getByRole('textbox', { name: /Tracking Number/ }))
    await user.type(
      screen.getByRole('textbox', { name: /Tracking Number/ }),
      'TRACK-123',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getAllByText('Field Team').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('TRACK-123').length).toBeGreaterThanOrEqual(1)
  })

  it('edits fulfillment status in the main edit form and updates the table and counts', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id, status: 'UNFULFILLED' },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(fulfillment.fulfillmentNumber))
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const assignmentHeading = screen.getByRole('heading', {
      name: 'Assignment',
    })
    const statusHeading = screen.getByRole('heading', { name: 'Status' })
    const shippingHeading = screen.getByRole('heading', {
      name: 'Shipping & Tracking',
    })
    expect(
      assignmentHeading.compareDocumentPosition(statusHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      statusHeading.compareDocumentPosition(shippingHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const statusSelect = screen.getByRole('combobox', {
      name: /Fulfillment Status/,
    })
    expect(statusSelect).toHaveProperty('value', 'UNFULFILLED')
    await user.selectOptions(statusSelect, 'READY_TO_SHIP')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(getPreviewFulfillments(workspaceId)[0]?.status).toBe(
        'READY_TO_SHIP',
      )
    })
    expect(screen.getAllByText('Ready to Ship').length).toBeGreaterThanOrEqual(
      1,
    )
    await user.click(
      screen.getByRole('button', { name: 'Show ready-to-ship fulfillments' }),
    )
    expect(
      within(tableBody()).getByText(fulfillment.fulfillmentNumber),
    ).toBeTruthy()
  })

  it('cancels edit-mode fulfillment status changes and restores the original value', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id, status: 'PACKING' },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(fulfillment.fulfillmentNumber))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Fulfillment Status/ }),
      'DELIVERED',
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(getPreviewFulfillments(workspaceId)[0]?.status).toBe('PACKING')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(
      screen.getByRole('combobox', { name: /Fulfillment Status/ }),
    ).toHaveProperty('value', 'PACKING')
  })

  it('renders related record navigation with canonical order, customer, and product ids', async () => {
    const user = userEvent.setup()
    const order = seedOrder({ customerName: 'Corbin Wesche' })
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id, fulfillmentNumber: 'FUL-01001' },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('FUL-01001'))

    const orderLink = screen.getByRole('link', { name: /Connected Order/ })
    expect(orderLink.getAttribute('href')).toBe(
      `/dashboard/northstar/orders?orderId=${order.id}`,
    )
    const customerLink = screen.getByRole('link', { name: /Commerce Customer/ })
    expect(customerLink.getAttribute('href')).toBe(
      `/dashboard/northstar/customers?customerId=${order.customerId}`,
    )
    const productLink = screen.getByRole('link', { name: /Product/ })
    expect(productLink.getAttribute('href')).toBe(
      '/dashboard/northstar/products?productId=product-kit',
    )

    const orderClick = vi.fn((event: Event) => event.preventDefault())
    orderLink.addEventListener('click', orderClick)
    orderLink.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(orderClick).toHaveBeenCalledTimes(2)
  })

  it('renders malformed related records as non-interactive information', async () => {
    const fulfillment = normalizePreviewFulfillment(
      {
        id: 'ful-missing-related',
        workspaceId,
        fulfillmentNumber: 'FUL-MISSING',
        orderId: 'missing-order',
        status: 'SHIPPED',
        priority: 'LOW',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      workspaceId,
    )
    window.localStorage.setItem(
      getCommercePreviewStorageKey({ workspaceId, collection: 'fulfillments' }),
      JSON.stringify({
        version: 1,
        workspaceId,
        records: [fulfillment],
      }),
    )

    const user = userEvent.setup()
    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('FUL-MISSING'))

    expect(
      screen.getAllByText('Order unavailable').length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('link', { name: /Connected Order/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Commerce Customer/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: /Commerce Customer/ }),
    ).toHaveProperty('disabled', true)
  })

  it('keeps customer notes shared and internal fulfillment notes local', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(fulfillment.fulfillmentNumber))

    await user.click(
      screen.getByRole('button', { name: 'Edit Customer Notes' }),
    )
    let noteBox = screen.getAllByRole('textbox').at(-1)!
    await user.clear(noteBox)
    await user.type(noteBox, 'Prefers front desk delivery.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(
      screen.getByRole('button', { name: 'Edit Internal Fulfillment Notes' }),
    )
    noteBox = screen.getAllByRole('textbox').at(-1)!
    await user.clear(noteBox)
    await user.type(noteBox, 'Pack with extra padding.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(getPreviewCustomers(workspaceId)[0]?.clientNotes).toBe(
      'Prefers front desk delivery.',
    )
    expect(getPreviewFulfillments(workspaceId)[0]?.internalNotes).toBe(
      'Pack with extra padding.',
    )
  })

  it('confirms high-impact fulfillment status updates and closes menus', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id },
    }).fulfillment!

    render(<FulfillmentPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(fulfillment.fulfillmentNumber))

    await user.click(
      screen.getByRole('button', { name: 'Update fulfillment status' }),
    )
    expect(
      screen.getByRole('listbox', { name: 'Fulfillment status options' }),
    ).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(
      screen.queryByRole('listbox', { name: 'Fulfillment status options' }),
    ).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Update fulfillment status' }),
    )
    await user.click(
      within(
        screen.getByRole('listbox', { name: 'Fulfillment status options' }),
      ).getByRole('option', { name: /Cancelled/ }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Confirm fulfillment update' }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.queryByRole('dialog', { name: 'Confirm fulfillment update' }),
    ).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Update fulfillment status' }),
    )
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('listbox', { name: 'Fulfillment status options' }),
    ).toBeNull()
  })
})
