import type { WorkspaceClient } from '@/lib/clients/types'
import type { TaskRecord } from '@/lib/tasks/demoTasks'
import {
  getWorkItemParent,
  getWorkItemParentTypeLabel,
} from '@/lib/tasks/workItems'

export type TaskCustomerIdentity = {
  customerName: string | null
  companyName: string | null
  parentTypeLabel: string
  parentLabel: string
  workItemSubtitle: string | null
}

function clean(value?: string | null) {
  const next = value?.trim()
  return next ? next : null
}

export function getTaskCustomerIdentity(
  task: TaskRecord,
  linkedClient?: WorkspaceClient | null,
): TaskCustomerIdentity {
  const parent = getWorkItemParent(task)
  const customerName = clean(linkedClient?.name) ?? clean(task.clientName)
  const companyName = clean(linkedClient?.company)
  const parentTypeLabel = getWorkItemParentTypeLabel(parent.type)
  const subtitleParts = [customerName, companyName].filter(Boolean)

  return {
    customerName,
    companyName,
    parentTypeLabel,
    parentLabel: parent.label,
    workItemSubtitle:
      subtitleParts.length > 0 ? subtitleParts.join(' · ') : null,
  }
}
