import {
  executeBulkAction,
  summarizeBulkItems,
  type BulkActionDefinition,
  type BulkActionResult,
} from '@/lib/bulk/bulkActions'
import { getPreviewCustomerTags } from '@/lib/commerce/previewCommerceTagStorage'
import {
  archivePreviewCustomer,
  updatePreviewCustomer,
} from '@/lib/commerce/previewCommerceStorage'
import type {
  CommerceCustomer,
  CommerceCustomerStatus,
} from '@/lib/commerce/types'

export type CommerceCustomerBulkInput =
  | { kind: 'tag-add'; tagIds: string[] }
  | { kind: 'tag-remove'; tagIds: string[] }
  | { kind: 'type'; customerTypeId?: string }
  | { kind: 'status'; lifecycleStatus: CommerceCustomerStatus }
  | { kind: 'archive' }
  | { kind: 'export' }

function selectedCustomers(records: CommerceCustomer[], selectedIds: string[]) {
  const selected = new Set(selectedIds)
  return records.filter((customer) => selected.has(customer.id))
}

function resultForUpdates({
  actionId,
  customers,
  update,
  successSummary,
}: {
  actionId: string
  customers: CommerceCustomer[]
  update: (customer: CommerceCustomer) => { ok: boolean; message?: string }
  successSummary: (count: number) => string
}): BulkActionResult {
  return summarizeBulkItems({
    actionId,
    items: customers.map((customer) => {
      const result = update(customer)
      return {
        id: customer.id,
        status: result.ok ? ('success' as const) : ('failed' as const),
        message: result.message,
      }
    }),
    successSummary,
  })
}

export const commerceCustomerBulkActions: BulkActionDefinition<
  CommerceCustomer,
  CommerceCustomerBulkInput
>[] = [
  {
    id: 'commerce.customer.tags.add',
    label: 'Add tags',
    recordType: 'commerce-customer',
    inputKind: 'tag-add',
    requiredPermission: 'member',
    supportsMixedValues: true,
    execute: ({ workspaceId, records, selectedIds, input }) => {
      if (input.kind !== 'tag-add') {
        return summarizeBulkItems({
          actionId: 'commerce.customer.tags.add',
          items: [],
          successSummary: () => 'No tag selected',
        })
      }
      const tags = getPreviewCustomerTags(workspaceId)
      const selectedTagIds = Array.from(new Set(input.tagIds))
      const selectedTags = selectedTagIds
        .map((tagId) => tags.find((tag) => tag.id === tagId))
        .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
      const inactiveTag = selectedTags.find((tag) => tag.status !== 'active')

      if (
        selectedTagIds.length === 0 ||
        selectedTags.length !== selectedTagIds.length ||
        inactiveTag
      ) {
        const error = inactiveTag
          ? 'Archived tags can be restored from Manage Tags before assigning them again.'
          : selectedTagIds.length === 0
            ? 'No tags selected.'
            : 'One or more selected tags are no longer available.'
        return summarizeBulkItems({
          actionId: 'commerce.customer.tags.add',
          items: selectedIds.map((id) => ({
            id,
            status: 'failed',
            message: error,
          })),
          successSummary: (count) => `${count} customers tagged`,
        })
      }
      const selectedTagSet = new Set(selectedTags.map((tag) => tag.id))
      return resultForUpdates({
        actionId: 'commerce.customer.tags.add',
        customers: selectedCustomers(records, selectedIds),
        update: (customer) => {
          const nextTags = Array.from(
            new Set([...(customer.tags ?? []), ...selectedTagSet]),
          )
          const result = updatePreviewCustomer({
            workspaceId,
            customerId: customer.id,
            changes: { tags: nextTags },
          })
          return {
            ok: Boolean(result.customer),
            message: result.errors.customer ?? result.errors.email,
          }
        },
        successSummary: (count) =>
          `${count} customers tagged with ${selectedTags.length} tag${
            selectedTags.length === 1 ? '' : 's'
          }`,
      })
    },
  },
  {
    id: 'commerce.customer.tags.remove',
    label: 'Remove tags',
    recordType: 'commerce-customer',
    inputKind: 'tag-remove',
    requiredPermission: 'member',
    supportsMixedValues: true,
    execute: ({ workspaceId, records, selectedIds, input }) => {
      if (input.kind !== 'tag-remove' || input.tagIds.length === 0) {
        return summarizeBulkItems({
          actionId: 'commerce.customer.tags.remove',
          items: selectedIds.map((id) => ({
            id,
            status: 'skipped',
            message: 'No tags selected.',
          })),
          successSummary: (count) => `${count} customers updated`,
        })
      }
      const removeSet = new Set(input.tagIds)
      return resultForUpdates({
        actionId: 'commerce.customer.tags.remove',
        customers: selectedCustomers(records, selectedIds),
        update: (customer) => {
          const currentTags = customer.tags ?? []
          if (!currentTags.some((tagId) => removeSet.has(tagId))) {
            return {
              ok: false,
              message: 'Customer did not have the selected tags.',
            }
          }
          const result = updatePreviewCustomer({
            workspaceId,
            customerId: customer.id,
            changes: {
              tags: currentTags.filter((tagId) => !removeSet.has(tagId)),
            },
          })
          return {
            ok: Boolean(result.customer),
            message: result.errors.customer ?? result.errors.email,
          }
        },
        successSummary: (count) => `${count} customers updated`,
      })
    },
  },
  {
    id: 'commerce.customer.type.change',
    label: 'Change type',
    recordType: 'commerce-customer',
    inputKind: 'type',
    requiredPermission: 'member',
    requiresConfirmation: true,
    supportsMixedValues: true,
    execute: ({ workspaceId, records, selectedIds, input }) => {
      if (input.kind !== 'type') {
        return summarizeBulkItems({
          actionId: 'commerce.customer.type.change',
          items: [],
          successSummary: () => 'No customer type selected',
        })
      }
      return resultForUpdates({
        actionId: 'commerce.customer.type.change',
        customers: selectedCustomers(records, selectedIds),
        update: (customer) => {
          const result = updatePreviewCustomer({
            workspaceId,
            customerId: customer.id,
            changes: { customerTypeId: input.customerTypeId },
          })
          return {
            ok: Boolean(result.customer),
            message: result.errors.customer ?? result.errors.email,
          }
        },
        successSummary: (count) => `${count} customer types updated`,
      })
    },
  },
  {
    id: 'commerce.customer.status.change',
    label: 'Change status',
    recordType: 'commerce-customer',
    inputKind: 'status',
    requiredPermission: 'member',
    requiresConfirmation: true,
    lifecycleSensitive: true,
    supportsMixedValues: true,
    execute: ({ workspaceId, records, selectedIds, input }) => {
      if (input.kind !== 'status') {
        return summarizeBulkItems({
          actionId: 'commerce.customer.status.change',
          items: [],
          successSummary: () => 'No status selected',
        })
      }
      return resultForUpdates({
        actionId: 'commerce.customer.status.change',
        customers: selectedCustomers(records, selectedIds),
        update: (customer) => {
          const result = updatePreviewCustomer({
            workspaceId,
            customerId: customer.id,
            changes: { lifecycleStatus: input.lifecycleStatus },
          })
          return {
            ok: Boolean(result.customer),
            message: result.errors.customer ?? result.errors.email,
          }
        },
        successSummary: (count) => `${count} customer statuses updated`,
      })
    },
  },
  {
    id: 'commerce.customer.archive',
    label: 'Archive',
    recordType: 'commerce-customer',
    inputKind: 'none',
    requiredPermission: 'member',
    requiresConfirmation: true,
    destructive: true,
    execute: ({ workspaceId, records, selectedIds }) =>
      resultForUpdates({
        actionId: 'commerce.customer.archive',
        customers: selectedCustomers(records, selectedIds),
        update: (customer) => {
          const result = archivePreviewCustomer({
            workspaceId,
            customerId: customer.id,
          })
          return {
            ok: Boolean(result.customer),
            message: result.errors.customer ?? result.errors.email,
          }
        },
        successSummary: (count) => `${count} customers archived`,
      }),
  },
  {
    id: 'commerce.customer.export',
    label: 'Export',
    recordType: 'commerce-customer',
    inputKind: 'export',
    requiredPermission: 'member',
    execute: ({ records, selectedIds }) => {
      const selected = selectedCustomers(records, selectedIds)
      return summarizeBulkItems({
        actionId: 'commerce.customer.export',
        items: selected.map((customer) => ({
          id: customer.id,
          status: 'success',
          message: [
            customer.displayName,
            customer.email ?? '',
            customer.phone ?? '',
            customer.lifecycleStatus,
            customer.customerTypeId ?? '',
          ].join(','),
        })),
        successSummary: (count) => `${count} customers prepared for export`,
      })
    },
  },
]

export function executeCommerceCustomerBulkAction({
  workspaceId,
  actionId,
  customers,
  selectedIds,
  input,
}: {
  workspaceId: string
  actionId: string
  customers: CommerceCustomer[]
  selectedIds: string[]
  input: CommerceCustomerBulkInput
}) {
  const action = commerceCustomerBulkActions.find(
    (item) => item.id === actionId,
  )
  if (!action) {
    return summarizeBulkItems({
      actionId,
      items: selectedIds.map((id) => ({
        id,
        status: 'failed',
        message: 'Bulk action is not registered.',
      })),
      successSummary: (count) => `${count} customers updated`,
    })
  }
  return executeBulkAction({
    action,
    context: {
      workspaceId,
      selectedIds,
      records: customers,
      input,
      permission: 'member',
    },
  })
}
