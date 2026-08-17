import { beforeEach, describe, expect, it } from 'vitest'

import {
  createPreviewCustomer,
  getPreviewCustomers,
  migratePreviewCustomerTags,
  removeCustomerTagFromAllCustomers,
} from '@/lib/commerce/previewCommerceStorage'
import {
  archivePreviewCustomerTag,
  createPreviewCustomerTag,
  deleteUnusedPreviewCustomerTag,
  getPreviewCustomerTags,
  renamePreviewCustomerTag,
  restorePreviewCustomerTag,
} from '@/lib/commerce/previewCommerceTagStorage'

describe('commerce customer tag registry', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('isolates workspace tags and rejects case-insensitive duplicates', () => {
    const first = createPreviewCustomerTag({
      workspaceId: 'workspace-a',
      label: 'VIP',
    })
    const duplicate = createPreviewCustomerTag({
      workspaceId: 'workspace-a',
      label: 'vip',
    })
    createPreviewCustomerTag({
      workspaceId: 'workspace-b',
      label: 'vip',
    })

    expect(first.tag?.label).toBe('VIP')
    expect(duplicate.errors.label).toBe('A tag with this name already exists.')
    expect(getPreviewCustomerTags('workspace-a')).toHaveLength(1)
    expect(getPreviewCustomerTags('workspace-b')).toHaveLength(1)
    expect(getPreviewCustomerTags('workspace-b')[0]?.label).toBe('vip')
  })

  it('archives, restores, renames, and deletes unused tags', () => {
    const tag = createPreviewCustomerTag({
      workspaceId: 'workspace-a',
      label: 'Local',
    }).tag!

    archivePreviewCustomerTag({ workspaceId: 'workspace-a', tagId: tag.id })
    expect(getPreviewCustomerTags('workspace-a')[0]?.status).toBe('archived')

    restorePreviewCustomerTag({ workspaceId: 'workspace-a', tagId: tag.id })
    expect(getPreviewCustomerTags('workspace-a')[0]?.status).toBe('active')

    const renamed = renamePreviewCustomerTag({
      workspaceId: 'workspace-a',
      tagId: tag.id,
      label: 'Neighborhood',
    })
    expect(renamed.tag?.id).toBe(tag.id)
    expect(getPreviewCustomerTags('workspace-a')[0]?.label).toBe('Neighborhood')

    const deleted = deleteUnusedPreviewCustomerTag({
      workspaceId: 'workspace-a',
      tagId: tag.id,
      customers: [],
    })
    expect(deleted.deleted).toBe(true)
    expect(getPreviewCustomerTags('workspace-a')).toHaveLength(0)
  })

  it('blocks deleting used tags until they are explicitly removed from customers', () => {
    const workspaceId = 'workspace-used-tag'
    const tag = createPreviewCustomerTag({ workspaceId, label: 'VIP' }).tag!
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Corbin Wesche',
        email: 'corbin@example.com',
        tags: [tag.id],
      },
    })

    const blocked = deleteUnusedPreviewCustomerTag({
      workspaceId,
      tagId: tag.id,
      customers: getPreviewCustomers(workspaceId),
    })
    expect(blocked.deleted).toBe(false)

    removeCustomerTagFromAllCustomers({ workspaceId, tagId: tag.id })
    const deleted = deleteUnusedPreviewCustomerTag({
      workspaceId,
      tagId: tag.id,
      customers: getPreviewCustomers(workspaceId),
    })
    expect(deleted.deleted).toBe(true)
    expect(getPreviewCustomers(workspaceId)[0]?.tags).toEqual([])
  })

  it('migrates legacy VIP type/status tags and Returning status safely', () => {
    const workspaceId = 'workspace-legacy-tags'
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Legacy VIP',
        email: 'legacy-vip@example.com',
        lifecycleStatus: 'VIP' as never,
        customerType: 'VIP' as never,
        tags: ['VIP', 'vip'],
      },
    })
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Legacy Returning',
        email: 'legacy-returning@example.com',
        lifecycleStatus: 'REPEAT' as never,
      },
    })

    const migrated = migratePreviewCustomerTags({ workspaceId })
    const tags = getPreviewCustomerTags(workspaceId)
    const vipTag = tags.find((tag) => tag.normalizedLabel === 'vip')
    const customers = getPreviewCustomers(workspaceId)

    expect(migrated.changed).toBe(true)
    expect(vipTag).toBeTruthy()
    expect(
      customers.find((customer) => customer.displayName === 'Legacy VIP')?.tags,
    ).toEqual([vipTag?.id])
    expect(
      customers.find((customer) => customer.displayName === 'Legacy VIP')
        ?.lifecycleStatus,
    ).toBe('ACTIVE')
    expect(
      customers.find((customer) => customer.displayName === 'Legacy Returning')
        ?.lifecycleStatus,
    ).toBe('ACTIVE')
  })
})
