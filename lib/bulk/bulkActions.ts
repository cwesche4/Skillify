import type { ReactNode } from 'react'

export type BulkRecordType =
  | 'lead'
  | 'opportunity'
  | 'sale'
  | 'client'
  | 'service-request'
  | 'task'
  | 'commerce-customer'
  | 'product'
  | 'order'
  | 'fulfillment'
  | 'automation'
  | 'execution'
  | 'template'
  | 'member'
  | 'admin-user'

export type BulkPermission = 'owner' | 'admin' | 'member' | 'system-admin'

export type BulkActionInputKind =
  | 'none'
  | 'tag-add'
  | 'tag-remove'
  | 'status'
  | 'type'
  | 'assignee'
  | 'priority'
  | 'date'
  | 'category'
  | 'export'

export type BulkActionSeverity = 'safe' | 'caution' | 'destructive'

export type BulkActionResultItem = {
  id: string
  status: 'success' | 'skipped' | 'failed'
  message?: string
}

export type BulkActionResult = {
  actionId: string
  total: number
  succeeded: number
  skipped: number
  failed: number
  summary: string
  items: BulkActionResultItem[]
}

export type BulkActionContext<TRecord, TInput = unknown> = {
  workspaceId: string
  selectedIds: string[]
  records: TRecord[]
  input: TInput
  permission: BulkPermission
}

export type BulkActionValidation = {
  ok: boolean
  message?: string
  eligibleIds?: string[]
  skipped?: BulkActionResultItem[]
}

export type BulkActionDefinition<TRecord = unknown, TInput = unknown> = {
  id: string
  label: string
  recordType: BulkRecordType
  icon?: ReactNode
  inputKind: BulkActionInputKind
  requiredPermission: BulkPermission
  maxSelection?: number
  requiresConfirmation?: boolean
  destructive?: boolean
  lifecycleSensitive?: boolean
  supportsMixedValues?: boolean
  severity?: BulkActionSeverity
  validate?: (
    context: BulkActionContext<TRecord, TInput>,
  ) => BulkActionValidation
  execute: (context: BulkActionContext<TRecord, TInput>) => BulkActionResult
}

const permissionRank: Record<BulkPermission, number> = {
  member: 1,
  admin: 2,
  owner: 3,
  'system-admin': 4,
}

export function canUseBulkAction(
  userPermission: BulkPermission,
  requiredPermission: BulkPermission,
) {
  return permissionRank[userPermission] >= permissionRank[requiredPermission]
}

export function emptyBulkActionResult({
  actionId,
  summary,
}: {
  actionId: string
  summary: string
}): BulkActionResult {
  return {
    actionId,
    total: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    summary,
    items: [],
  }
}

export function summarizeBulkItems({
  actionId,
  items,
  successSummary,
}: {
  actionId: string
  items: BulkActionResultItem[]
  successSummary: (count: number) => string
}): BulkActionResult {
  const succeeded = items.filter((item) => item.status === 'success').length
  const skipped = items.filter((item) => item.status === 'skipped').length
  const failed = items.filter((item) => item.status === 'failed').length
  const parts = [successSummary(succeeded)]
  if (skipped) parts.push(`${skipped} skipped`)
  if (failed) parts.push(`${failed} failed`)
  return {
    actionId,
    total: items.length,
    succeeded,
    skipped,
    failed,
    summary: parts.join(', '),
    items,
  }
}

export function executeBulkAction<TRecord, TInput>({
  action,
  context,
}: {
  action: BulkActionDefinition<TRecord, TInput>
  context: BulkActionContext<TRecord, TInput>
}) {
  if (!canUseBulkAction(context.permission, action.requiredPermission)) {
    return emptyBulkActionResult({
      actionId: action.id,
      summary: 'You do not have permission to perform this bulk action.',
    })
  }
  if (action.maxSelection && context.selectedIds.length > action.maxSelection) {
    return emptyBulkActionResult({
      actionId: action.id,
      summary: `Select ${action.maxSelection} or fewer records for this action.`,
    })
  }
  const validation = action.validate?.(context)
  if (validation && !validation.ok) {
    return {
      actionId: action.id,
      total: context.selectedIds.length,
      succeeded: 0,
      skipped: validation.skipped?.length ?? context.selectedIds.length,
      failed: 0,
      summary: validation.message ?? 'No selected records are eligible.',
      items:
        validation.skipped ??
        context.selectedIds.map((id) => ({
          id,
          status: 'skipped' as const,
          message: validation.message,
        })),
    }
  }
  return action.execute(context)
}
