import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_CUSTOMER_TYPE_NAMES } from '@/lib/commerce/customerTypeRegistry'
import {
  createPreviewCustomer,
  getPreviewCustomers,
  migratePreviewCustomerTypes,
} from '@/lib/commerce/previewCommerceStorage'
import {
  archivePreviewCustomerType,
  createPreviewCustomerType,
  deleteUnusedPreviewCustomerType,
  getPreviewCustomerTypes,
  renamePreviewCustomerType,
  reorderPreviewCustomerType,
  restorePreviewCustomerType,
} from '@/lib/commerce/previewCommerceCustomerTypeStorage'

describe('commerce customer type registry', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('creates default workspace types and isolates workspaces', () => {
    const first = getPreviewCustomerTypes('workspace-a')
    const second = getPreviewCustomerTypes('workspace-b')

    expect(first.map((type) => type.name)).toEqual([
      ...DEFAULT_CUSTOMER_TYPE_NAMES,
    ])
    expect(second.map((type) => type.name)).toEqual([
      ...DEFAULT_CUSTOMER_TYPE_NAMES,
    ])
    expect(first.every((type) => type.workspaceId === 'workspace-a')).toBe(true)
    expect(second.every((type) => type.workspaceId === 'workspace-b')).toBe(
      true,
    )
  })

  it('rejects duplicate type names case-insensitively inside a workspace', () => {
    const duplicate = createPreviewCustomerType({
      workspaceId: 'workspace-a',
      name: 'retail',
    })
    const otherWorkspace = createPreviewCustomerType({
      workspaceId: 'workspace-b',
      name: 'retail',
    })

    expect(duplicate.errors.name).toBe(
      'A customer type with this name already exists.',
    )
    expect(otherWorkspace.errors.name).toBe(
      'A customer type with this name already exists.',
    )
  })

  it('renames and reorders types without breaking stable IDs', () => {
    const workspaceId = 'workspace-types'
    const retail = getPreviewCustomerTypes(workspaceId).find(
      (type) => type.name === 'Retail',
    )!

    const renamed = renamePreviewCustomerType({
      workspaceId,
      typeId: retail.id,
      name: 'Retail Buyer',
    })
    expect(renamed.type?.id).toBe(retail.id)
    expect(
      getPreviewCustomerTypes(workspaceId).find((type) => type.id === retail.id)
        ?.name,
    ).toBe('Retail Buyer')

    reorderPreviewCustomerType({
      workspaceId,
      typeId: retail.id,
      direction: 'up',
    })
    const reordered = getPreviewCustomerTypes(workspaceId)
    expect(reordered.findIndex((type) => type.id === retail.id)).toBeLessThan(
      reordered.findIndex((type) => type.name === 'Wholesale'),
    )
  })

  it('archives, restores, and only deletes unused types', () => {
    const workspaceId = 'workspace-used-type'
    const commercial = getPreviewCustomerTypes(workspaceId).find(
      (type) => type.name === 'Commercial',
    )!
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Commercial Buyer',
        email: 'commercial@example.com',
        customerTypeId: commercial.id,
      },
    })

    archivePreviewCustomerType({ workspaceId, typeId: commercial.id })
    expect(
      getPreviewCustomerTypes(workspaceId).find(
        (type) => type.id === commercial.id,
      )?.isArchived,
    ).toBe(true)
    expect(getPreviewCustomers(workspaceId)[0]?.customerTypeId).toBe(
      commercial.id,
    )

    const blocked = deleteUnusedPreviewCustomerType({
      workspaceId,
      typeId: commercial.id,
      customers: getPreviewCustomers(workspaceId),
    })
    expect(blocked.deleted).toBe(false)

    restorePreviewCustomerType({ workspaceId, typeId: commercial.id })
    expect(
      getPreviewCustomerTypes(workspaceId).find(
        (type) => type.id === commercial.id,
      )?.isActive,
    ).toBe(true)

    const custom = createPreviewCustomerType({
      workspaceId,
      name: 'One-time segment',
    }).type!
    const deleted = deleteUnusedPreviewCustomerType({
      workspaceId,
      typeId: custom.id,
      customers: getPreviewCustomers(workspaceId),
    })
    expect(deleted.deleted).toBe(true)
    expect(
      getPreviewCustomerTypes(workspaceId).some(
        (type) => type.id === custom.id,
      ),
    ).toBe(false)
  })

  it('normalizes legacy plain-string customer types safely', () => {
    const workspaceId = 'workspace-legacy-types'
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Legacy Commercial',
        email: 'legacy-commercial@example.com',
        customerType: 'COMMERCIAL',
      },
    })

    const migrated = migratePreviewCustomerTypes({ workspaceId })
    const commercial = getPreviewCustomerTypes(workspaceId).find(
      (type) => type.name === 'Commercial',
    )

    expect(migrated.changed).toBe(true)
    expect(commercial).toBeTruthy()
    expect(getPreviewCustomers(workspaceId)[0]?.customerTypeId).toBe(
      commercial?.id,
    )
  })

  it('creates safe registry rows for unmatched legacy customer type names', () => {
    const workspaceId = 'workspace-legacy-custom-type'
    createPreviewCustomer({
      workspaceId,
      input: {
        displayName: 'Installer Buyer',
        email: 'installer@example.com',
        customerType: 'Installer' as never,
      },
    })

    migratePreviewCustomerTypes({ workspaceId })
    const installer = getPreviewCustomerTypes(workspaceId).find(
      (type) => type.name === 'Installer',
    )

    expect(installer).toBeTruthy()
    expect(
      getPreviewCustomerTypes(workspaceId).some(
        (type) => type.name === 'Installer',
      ),
    ).toBe(true)
    expect(getPreviewCustomers(workspaceId)[0]?.customerTypeId).toBe(
      installer?.id,
    )
    expect(
      getPreviewCustomers(workspaceId)[0]?.legacyCustomerTypeName,
    ).toBeUndefined()
  })
})
