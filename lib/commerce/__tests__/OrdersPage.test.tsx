import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { OrdersPage } from '@/components/commerce/OrdersPage'
import {
  createPreviewCustomer,
  createPreviewFulfillment,
  createPreviewOrder,
  getCommercePreviewStorageKey,
  getPreviewOrderActivities,
  normalizePreviewProduct,
} from '@/lib/commerce/previewCommerceStorage'
import type { CommerceProduct } from '@/lib/commerce/types'

const workspaceId = 'orders-page-ux-workspace'

function product(input: Partial<CommerceProduct>) {
  return normalizePreviewProduct(
    {
      id: input.id ?? 'product-1',
      workspaceId,
      name: input.name ?? 'Service Plan',
      status: input.status ?? 'ACTIVE',
      price: input.price ?? { amount: 125, currency: 'USD' },
      cost: input.cost ?? { amount: 70, currency: 'USD' },
      taxable: true,
      trackInventory: false,
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
  companyName,
}: {
  companyName?: string
} = {}) {
  const seededProduct = product({
    id: 'product-maintenance',
    name: 'Preventive Maintenance',
    price: { amount: 125, currency: 'USD' },
    cost: { amount: 70, currency: 'USD' },
  })
  seedProducts([seededProduct])
  const customer = createPreviewCustomer({
    workspaceId,
    input: {
      displayName: 'NorthStar Electric',
      companyName,
      email: 'owner@northstar.example',
    },
  }).customer
  const order = createPreviewOrder({
    workspaceId,
    input: {
      customerId: customer?.id,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'UNFULFILLED',
      shippingCharge: 15,
      shippingCost: 10,
      shippingPayer: 'CUSTOMER',
      lines: [
        {
          productId: seededProduct.id,
          name: seededProduct.name,
          quantity: 1,
          unitPrice: 125,
          unitCost: 70,
          taxTotal: 8,
        },
      ],
    },
  }).order!
  return order
}

async function openAddOrder() {
  const user = userEvent.setup()
  render(<OrdersPage workspaceId={workspaceId} />)
  await user.click(screen.getAllByRole('button', { name: 'Add Order' })[0]!)
  return user
}

async function clickActiveSave(user: ReturnType<typeof userEvent.setup>) {
  const saveButton = screen
    .getAllByRole('button', { name: 'Save' })
    .find((button) => !(button as HTMLButtonElement).disabled)
  expect(saveButton).toBeTruthy()
  await user.click(saveButton!)
}

function tableBody() {
  return screen.getAllByRole('rowgroup')[1]!
}

describe('OrdersPage order drawer UX', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('clears secondary order filters from the primary chip row', async () => {
    const user = userEvent.setup()
    seedOrder()

    render(<OrdersPage workspaceId={workspaceId} />)

    await user.type(
      screen.getByPlaceholderText('Search order, customer, item, SKU...'),
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
      screen.getByRole('button', { name: 'All Orders' }).className,
    ).toContain('text-cyan-100')
    expect(within(tableBody()).getByText('NorthStar Electric')).toBeTruthy()
  })

  it('uses clear inline customer wording and keeps company optional', async () => {
    const user = await openAddOrder()

    const createCustomerButton = screen.getByRole('button', {
      name: 'Create Customer',
    })
    expect(createCustomerButton).toBeTruthy()

    await user.click(createCustomerButton)
    expect(screen.getByRole('button', { name: 'New Customer' })).toBeTruthy()
    expect(
      screen.getByPlaceholderText('Optional company or organization'),
    ).toBeTruthy()
  })

  it('shows drawer-safe line item fields and a visible line total', async () => {
    seedProducts([product({ name: 'Preventive Maintenance' })])
    await openAddOrder()

    const lineItem = screen
      .getByText('Item 1')
      .closest('.rounded-2xl') as HTMLElement | null
    expect(lineItem).toBeTruthy()
    expect(within(lineItem!).getByText('Variant / Item')).toBeTruthy()
    expect(within(lineItem!).getByText('Qty')).toBeTruthy()
    expect(within(lineItem!).getByText('Unit price')).toBeTruthy()
    expect(within(lineItem!).getByText('Discount type')).toBeTruthy()
    expect(within(lineItem!).getByText('Discount value')).toBeTruthy()
    expect(within(lineItem!).getByText('Unit cost')).toBeTruthy()
    expect(within(lineItem!).getByText('Tax')).toBeTruthy()
    expect(within(lineItem!).getByText('Line total')).toBeTruthy()
  })

  it('places the shipping estimate action with accessible wording', async () => {
    await openAddOrder()

    const estimateButton = screen.getByRole('button', {
      name: 'Use shipping charge as the estimated business shipping cost',
    })
    expect(estimateButton.textContent).toContain('Use charge as estimate')
  })

  it('updates shipping cost helper copy from estimated to actual immediately', async () => {
    const user = await openAddOrder()

    expect(
      screen.getByText('Estimated business shipping expense.'),
    ).toBeTruthy()

    await user.selectOptions(
      screen.getByLabelText('Shipping cost state'),
      'ACTUAL',
    )
    expect(screen.getByText('Final business shipping expense.')).toBeTruthy()
    expect(
      screen.queryByText('Estimated business shipping expense.'),
    ).toBeNull()
  })

  it('keeps calculation details collapsed until the disclosure is opened', async () => {
    const user = await openAddOrder()

    const detailsButton = screen.getByRole('button', {
      name: 'View calculation details',
    })
    expect(detailsButton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Merchandise revenue')).toBeNull()

    await user.click(detailsButton)
    expect(detailsButton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('How calculations work')).toBeTruthy()
    expect(screen.getAllByText('Merchandise gross profit')).toHaveLength(2)
    expect(
      screen.getByText('measures product profitability before shipping.'),
    ).toBeTruthy()
    expect(
      screen.getAllByText('Order gross profit').length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText(
        'includes shipping revenue and business shipping expense.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('Merchandise revenue')).toBeTruthy()
    expect(screen.getByText('Shipping revenue')).toBeTruthy()
    expect(screen.getByText('Total order revenue')).toBeTruthy()
    expect(screen.getAllByText('Merchandise gross profit')).toHaveLength(2)
    expect(screen.getByText('Merchandise margin')).toBeTruthy()
    expect(screen.getAllByText('Order gross profit')).toHaveLength(3)
    expect(screen.getAllByText('Order margin')).toHaveLength(2)
    expect(
      screen.getByText(
        'Merchandise margin = merchandise gross profit divided by merchandise revenue.',
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Order margin = order gross profit divided by total order revenue.',
      ),
    ).toBeTruthy()
  })

  it('uses the same collapsed calculation details in the read-only drawer', async () => {
    const user = userEvent.setup()
    seedOrder()

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('ORD-01001'))

    const detailsButton = screen.getByRole('button', {
      name: 'View calculation details',
    })
    expect(detailsButton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Merchandise revenue')).toBeNull()

    await user.click(detailsButton)
    expect(detailsButton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Merchandise revenue')).toBeTruthy()
  })

  it('opens domain-specific quick status menus from the read-only drawer', async () => {
    const user = userEvent.setup()
    seedOrder()

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('ORD-01001'))

    await user.click(
      screen.getByRole('button', { name: 'Update order status' }),
    )
    const orderMenu = screen.getByRole('listbox', {
      name: 'Order status options',
    })
    expect(
      within(orderMenu).getByRole('option', { name: /Confirmed/ }),
    ).toBeTruthy()
    expect(within(orderMenu).queryByRole('option', { name: /Paid/ })).toBeNull()
    expect(
      within(orderMenu)
        .getByRole('option', { name: /Pending/ })
        .getAttribute('aria-selected'),
    ).toBe('true')

    await user.click(
      screen.getByRole('button', { name: 'Update payment status' }),
    )
    const paymentMenu = screen.getByRole('listbox', {
      name: 'Payment status options',
    })
    expect(
      within(paymentMenu).getByRole('option', { name: /Paid/ }),
    ).toBeTruthy()
    expect(
      within(paymentMenu).queryByRole('option', { name: /Confirmed/ }),
    ).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Update fulfillment status' }),
    )
    const fulfillmentMenu = screen.getByRole('listbox', {
      name: 'Fulfillment status options',
    })
    expect(
      within(fulfillmentMenu).getByRole('option', { name: /Shipped/ }),
    ).toBeTruthy()
    expect(
      within(fulfillmentMenu).queryByRole('option', { name: /Paid/ }),
    ).toBeNull()
  })

  it('persists a quick payment status update and refreshes the drawer and table', async () => {
    const user = userEvent.setup()
    const order = seedOrder()

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('ORD-01001'))

    await user.click(
      screen.getByRole('button', { name: 'Update payment status' }),
    )
    await user.click(
      within(
        screen.getByRole('listbox', { name: 'Payment status options' }),
      ).getByRole('option', { name: /Paid/ }),
    )

    expect(screen.getByText('Unsaved status changes.')).toBeTruthy()
    expect(getPreviewOrderActivities(workspaceId, order.id)[0]?.title).toBe(
      'Order created',
    )
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(2)
    })
    const activities = getPreviewOrderActivities(workspaceId, order.id)
    expect(activities[0]).toMatchObject({
      title: 'Payment status updated',
      description: 'Unpaid changed to Paid.',
    })
    expect(
      activities.filter(
        (activity) => activity.title === 'Payment status updated',
      ),
    ).toHaveLength(1)
  })

  it('opens the connected fulfillment from order related records without stacking drawers', async () => {
    const user = userEvent.setup()
    const order = seedOrder()
    const fulfillment = createPreviewFulfillment({
      workspaceId,
      input: { orderId: order.id, assignedTo: 'Operations' },
    }).fulfillment!

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText(order.orderNumber))
    await user.click(screen.getByRole('button', { name: /Fulfillment/ }))

    expect(screen.queryByText('Order Detail')).toBeNull()
    expect(
      screen.getAllByText(fulfillment.fulfillmentNumber).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('FULFILLMENT')).toBeTruthy()
  })

  it('confirms high-impact quick status updates before applying them', async () => {
    const user = userEvent.setup()
    seedOrder()

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('ORD-01001'))

    await user.click(
      screen.getByRole('button', { name: 'Update order status' }),
    )
    await user.click(
      within(
        screen.getByRole('listbox', { name: 'Order status options' }),
      ).getByRole('option', { name: /Cancelled/ }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Confirm status update' }),
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.queryByRole('dialog', { name: 'Confirm status update' }),
    ).toBeNull()
    expect(screen.queryByText('Order status updated')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Update order status' }).textContent,
    ).toContain('Pending')

    await user.click(
      screen.getByRole('button', { name: 'Update order status' }),
    )
    await user.click(
      within(
        screen.getByRole('listbox', { name: 'Order status options' }),
      ).getByRole('option', { name: /Cancelled/ }),
    )
    await user.click(screen.getByRole('button', { name: 'Confirm update' }))
    expect(screen.getByText('Unsaved status changes.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(screen.getByText('Order status updated')).toBeTruthy()
    })
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(2)
  })

  it('closes quick status menus on outside click, Escape, and keyboard selection', async () => {
    const user = userEvent.setup()
    seedOrder()

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('ORD-01001'))

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
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('listbox', { name: 'Fulfillment status options' }),
    ).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Update fulfillment status' }),
    )
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => {
      expect(screen.getAllByText('Picking').length).toBeGreaterThanOrEqual(2)
    })
  })

  it('keeps full edit mode status selects backed by the same registries', async () => {
    const user = userEvent.setup()
    seedOrder()

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('ORD-01001'))
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const orderStatus = screen.getByRole('combobox', { name: /Order Status/ })
    const paymentStatus = screen.getByRole('combobox', {
      name: /Payment Status/,
    })
    const fulfillmentStatus = screen.getByRole('combobox', {
      name: /Fulfillment Status/,
    })

    expect(
      within(orderStatus).getByRole('option', { name: 'Confirmed' }),
    ).toBeTruthy()
    expect(
      within(paymentStatus).getByRole('option', { name: 'Paid' }),
    ).toBeTruthy()
    expect(
      within(fulfillmentStatus).getByRole('option', { name: 'Ready to Ship' }),
    ).toBeTruthy()
  })

  it('shows meaningful company values in the read-only drawer', async () => {
    const user = userEvent.setup()
    seedOrder({ companyName: 'NorthStar Holdings' })

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('ORD-01001'))

    expect(screen.getByText('Company')).toBeTruthy()
    expect(screen.getByText('NorthStar Holdings')).toBeTruthy()
  })

  it('omits empty and not-set company values in the read-only drawer', async () => {
    const user = userEvent.setup()
    seedOrder({ companyName: 'Not set' })

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('ORD-01001'))

    expect(screen.queryByText('Company')).toBeNull()
  })

  it('keeps company editable and updates the read-only display after save', async () => {
    const user = userEvent.setup()
    seedOrder()

    render(<OrdersPage workspaceId={workspaceId} />)
    await user.click(screen.getByText('ORD-01001'))
    expect(screen.queryByText('Company')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const companyInput = screen.getByPlaceholderText(
      'Optional company or organization',
    )
    expect(companyInput).toBeTruthy()

    await user.type(companyInput, 'NorthStar Holdings')
    await clickActiveSave(user)
    await waitFor(() => {
      expect(screen.getByText('NorthStar Holdings')).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByDisplayValue('NorthStar Holdings'))
    await clickActiveSave(user)
    await waitFor(() => {
      expect(screen.queryByText('Company')).toBeNull()
    })
  })
})
