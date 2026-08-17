import { beforeEach, describe, expect, it } from 'vitest'

import { executeCommerceCustomerBulkAction } from '@/lib/commerce/customerBulkActions'
import {
  createPreviewCustomer,
  getPreviewCustomers,
} from '@/lib/commerce/previewCommerceStorage'
import {
  archivePreviewCustomerTag,
  createPreviewCustomerTag,
  getPreviewCustomerTags,
} from '@/lib/commerce/previewCommerceTagStorage'
import { getPreviewCustomerTypes } from '@/lib/commerce/previewCommerceCustomerTypeStorage'

const workspaceId = 'customer-bulk-actions-workspace'

function seedCustomers() {
  const first = createPreviewCustomer({
    workspaceId,
    input: {
      displayName: 'First Buyer',
      email: 'first@example.com',
      tags: ['existing'],
    },
  }).customer!
  const second = createPreviewCustomer({
    workspaceId,
    input: {
      displayName: 'Second Buyer',
      email: 'second@example.com',
    },
  }).customer!
  return [first, second]
}

describe('commerce customer bulk actions', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('bulk adds tags while preserving existing customer tags', () => {
    const seeded = seedCustomers()
    const wholesale = createPreviewCustomerTag({
      workspaceId,
      label: 'Wholesale',
    }).tag!
    const result = executeCommerceCustomerBulkAction({
      workspaceId,
      actionId: 'commerce.customer.tags.add',
      customers: getPreviewCustomers(workspaceId),
      selectedIds: seeded.map((customer) => customer.id),
      input: { kind: 'tag-add', tagIds: [wholesale.id] },
    })
    const customers = getPreviewCustomers(workspaceId)
    const first = customers.find((customer) => customer.id === seeded[0]!.id)
    const second = customers.find((customer) => customer.id === seeded[1]!.id)

    expect(result.succeeded).toBe(2)
    expect(wholesale).toBeTruthy()
    expect(first?.tags).toContain('existing')
    expect(first?.tags).toContain(wholesale?.id)
    expect(second?.tags).toContain(wholesale?.id)
  })

  it('bulk removes tags without deleting tag definitions', () => {
    const tag = createPreviewCustomerTag({ workspaceId, label: 'VIP' }).tag!
    const customers = [
      createPreviewCustomer({
        workspaceId,
        input: {
          displayName: 'Tagged Buyer',
          email: 'tagged@example.com',
          tags: [tag.id],
        },
      }).customer!,
      createPreviewCustomer({
        workspaceId,
        input: {
          displayName: 'Plain Buyer',
          email: 'plain@example.com',
        },
      }).customer!,
    ]

    const result = executeCommerceCustomerBulkAction({
      workspaceId,
      actionId: 'commerce.customer.tags.remove',
      customers: getPreviewCustomers(workspaceId),
      selectedIds: customers.map((customer) => customer.id),
      input: { kind: 'tag-remove', tagIds: [tag.id] },
    })

    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(getPreviewCustomers(workspaceId)[0]?.tags).not.toContain(tag.id)
    expect(
      getPreviewCustomerTags(workspaceId).some(
        (record) => record.id === tag.id,
      ),
    ).toBe(true)
  })

  it('bulk changes customer type and relationship status separately', () => {
    const customers = seedCustomers()
    const commercial = getPreviewCustomerTypes(workspaceId).find(
      (type) => type.name === 'Commercial',
    )!

    executeCommerceCustomerBulkAction({
      workspaceId,
      actionId: 'commerce.customer.type.change',
      customers: getPreviewCustomers(workspaceId),
      selectedIds: customers.map((customer) => customer.id),
      input: { kind: 'type', customerTypeId: commercial.id },
    })
    executeCommerceCustomerBulkAction({
      workspaceId,
      actionId: 'commerce.customer.status.change',
      customers: getPreviewCustomers(workspaceId),
      selectedIds: [customers[0]!.id],
      input: { kind: 'status', lifecycleStatus: 'AT_RISK' },
    })

    const updated = getPreviewCustomers(workspaceId)
    const first = updated.find((customer) => customer.id === customers[0]!.id)
    const second = updated.find((customer) => customer.id === customers[1]!.id)
    expect(
      updated.every((customer) => customer.customerTypeId === commercial.id),
    ).toBe(true)
    expect(first?.lifecycleStatus).toBe('AT_RISK')
    expect(second?.lifecycleStatus).toBe('NEW')
  })

  it('does not assign archived tags as new bulk tag values', () => {
    const customers = seedCustomers()
    const tag = createPreviewCustomerTag({
      workspaceId,
      label: 'Archived',
    }).tag!
    archivePreviewCustomerTag({ workspaceId, tagId: tag.id })

    const result = executeCommerceCustomerBulkAction({
      workspaceId,
      actionId: 'commerce.customer.tags.add',
      customers: getPreviewCustomers(workspaceId),
      selectedIds: customers.map((customer) => customer.id),
      input: { kind: 'tag-add', tagIds: [tag.id] },
    })

    expect(result.failed).toBe(2)
    expect(
      getPreviewCustomers(workspaceId).every(
        (customer) => !customer.tags?.includes(tag.id),
      ),
    ).toBe(true)
  })

  it('archives customers without deleting related records or metrics', () => {
    const customers = seedCustomers()

    const result = executeCommerceCustomerBulkAction({
      workspaceId,
      actionId: 'commerce.customer.archive',
      customers: getPreviewCustomers(workspaceId),
      selectedIds: customers.map((customer) => customer.id),
      input: { kind: 'archive' },
    })

    expect(result.succeeded).toBe(2)
    expect(
      getPreviewCustomers(workspaceId).every(
        (customer) => customer.lifecycleStatus === 'INACTIVE',
      ),
    ).toBe(true)
  })
})
