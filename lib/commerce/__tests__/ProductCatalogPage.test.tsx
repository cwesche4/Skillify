import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { ProductCatalogPage } from '@/components/commerce/ProductCatalogPage'
import {
  getCommercePreviewStorageKey,
  normalizePreviewProduct,
} from '@/lib/commerce/previewCommerceStorage'
import type { CommerceProduct } from '@/lib/commerce/types'

const workspaceId = 'catalog-summary-workspace'

function product(input: Partial<CommerceProduct>) {
  return normalizePreviewProduct(
    {
      id: input.id ?? `product-${input.name}`,
      workspaceId,
      name: input.name ?? 'Product',
      status: input.status ?? 'ACTIVE',
      price: input.price ?? { amount: 10, currency: 'USD' },
      taxable: true,
      trackInventory: input.trackInventory ?? false,
      hasVariants: input.hasVariants ?? false,
      variants: input.variants ?? [],
      createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
      updatedAt: input.updatedAt ?? '2026-01-01T00:00:00.000Z',
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

function tableBody() {
  return screen.getAllByRole('rowgroup')[1]!
}

describe('ProductCatalogPage summary filters', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('clicking summary cards activates the same product views as filter chips', async () => {
    const user = userEvent.setup()
    seedProducts([
      product({ id: 'active', name: 'Active Product', status: 'ACTIVE' }),
      product({ id: 'draft', name: 'Draft Product', status: 'DRAFT' }),
      product({ id: 'archived', name: 'Archived Product', status: 'ARCHIVED' }),
      product({
        id: 'low',
        name: 'Low Stock Product',
        status: 'ACTIVE',
        trackInventory: true,
        inventoryQuantity: 2,
        lowStockThreshold: 5,
      }),
    ])

    render(<ProductCatalogPage workspaceId={workspaceId} />)

    await user.click(
      screen.getByRole('button', { name: 'Show active products' }),
    )
    expect(
      screen
        .getByRole('button', { name: 'Show active products' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: /Active\s+2/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(within(tableBody()).getByText('Active Product')).toBeTruthy()
    expect(within(tableBody()).getByText('Low Stock Product')).toBeTruthy()
    expect(within(tableBody()).queryByText('Draft Product')).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Show low-stock products' }),
    )
    expect(
      screen
        .getByRole('button', { name: 'Show low-stock products' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: /Low Stock\s+1/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(within(tableBody()).getByText('Low Stock Product')).toBeTruthy()
    expect(within(tableBody()).queryByText('Active Product')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Show all products' }))
    expect(
      screen
        .getByRole('button', { name: 'Show all products' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: /All Products\s+4/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(within(tableBody()).getByText('Archived Product')).toBeTruthy()
  })

  it('clicking a filter chip activates the matching summary card', async () => {
    const user = userEvent.setup()
    seedProducts([
      product({ id: 'active', name: 'Active Product', status: 'ACTIVE' }),
      product({ id: 'draft', name: 'Draft Product', status: 'DRAFT' }),
    ])

    render(<ProductCatalogPage workspaceId={workspaceId} />)

    await user.click(screen.getByRole('button', { name: /Draft\s+1/i }))
    expect(
      screen
        .getByRole('button', { name: /Draft\s+1/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: 'Show draft products' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(within(tableBody()).getByText('Draft Product')).toBeTruthy()
    expect(within(tableBody()).queryByText('Active Product')).toBeNull()
  })

  it('clears secondary filters while preserving the selected product view and sort', async () => {
    const user = userEvent.setup()
    seedProducts([
      product({ id: 'active', name: 'Active Product', status: 'ACTIVE' }),
      product({ id: 'draft', name: 'Draft Product', status: 'DRAFT' }),
    ])

    render(<ProductCatalogPage workspaceId={workspaceId} />)

    await user.click(screen.getByRole('button', { name: /Active\s+1/i }))
    expect(
      (screen.getByLabelText('Filter by status') as HTMLSelectElement).value,
    ).toBe('ACTIVE')

    await user.type(screen.getByLabelText('Search products'), 'missing')
    expect(
      screen.getByRole('button', { name: /Clear 1 active filter/i }),
    ).toBeTruthy()
    expect(screen.queryByText('Active Product')).toBeNull()

    await user.click(
      screen.getByRole('button', { name: /Clear 1 active filter/i }),
    )
    expect(
      screen.queryByRole('button', { name: /Clear .* active filter/i }),
    ).toBeNull()
    expect(
      screen
        .getByRole('button', { name: /Active\s+1/i })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      (screen.getByLabelText('Filter by status') as HTMLSelectElement).value,
    ).toBe('ACTIVE')
    expect(within(tableBody()).getByText('Active Product')).toBeTruthy()
    expect(within(tableBody()).queryByText('Draft Product')).toBeNull()
  })

  it('keeps zero-count summary cards interactive and archived chip-only', async () => {
    const user = userEvent.setup()
    seedProducts([
      product({ id: 'active', name: 'Active Product', status: 'ACTIVE' }),
      product({ id: 'archived', name: 'Archived Product', status: 'ARCHIVED' }),
    ])

    render(<ProductCatalogPage workspaceId={workspaceId} />)

    const lowStockCard = screen.getByRole('button', {
      name: 'Show low-stock products',
    }) as HTMLButtonElement
    expect(lowStockCard.disabled).toBe(false)
    await user.click(lowStockCard)
    expect(lowStockCard.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('No products match these filters')).toBeTruthy()

    expect(
      screen.queryByRole('button', { name: 'Show archived products' }),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: /Archived\s+1/i }))
    expect(within(tableBody()).getByText('Archived Product')).toBeTruthy()
  })

  it('supports keyboard activation for summary cards', async () => {
    const user = userEvent.setup()
    seedProducts([
      product({ id: 'active', name: 'Active Product', status: 'ACTIVE' }),
      product({ id: 'draft', name: 'Draft Product', status: 'DRAFT' }),
    ])

    render(<ProductCatalogPage workspaceId={workspaceId} />)

    screen.getByRole('button', { name: 'Show draft products' }).focus()
    await user.keyboard('{Enter}')
    expect(
      screen
        .getByRole('button', { name: 'Show draft products' })
        .getAttribute('aria-pressed'),
    ).toBe('true')

    screen.getByRole('button', { name: 'Show all products' }).focus()
    await user.keyboard(' ')
    expect(
      screen
        .getByRole('button', { name: 'Show all products' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(within(tableBody()).getByText('Active Product')).toBeTruthy()
    expect(within(tableBody()).getByText('Draft Product')).toBeTruthy()
  })
})
