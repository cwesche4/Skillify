import type {
  TaskRecord,
  WorkItemChecklistItem,
  WorkItemParentType,
} from '@/lib/tasks/demoTasks'

export type WorkItemChecklistProgress = {
  total: number
  completed: number
  percent: number
  label: string
}

export type WorkItemParent = {
  type: WorkItemParentType
  id: string
  label: string
}

export function getWorkItemParent(task: TaskRecord): WorkItemParent {
  if (task.parentType && task.parentId && task.parentLabel) {
    return {
      type: task.parentType,
      id: task.parentId,
      label: task.parentLabel,
    }
  }

  if (task.relatedRecordType === 'serviceRequest') {
    return {
      type: 'serviceRequest',
      id: task.relatedRecordId,
      label: task.relatedRecordLabel,
    }
  }

  if (task.relatedRecordType === 'project') {
    return {
      type: 'project',
      id: task.relatedRecordId,
      label: task.relatedRecordLabel,
    }
  }

  if (task.relatedRecordType === 'client') {
    return {
      type: 'client',
      id: task.relatedRecordId,
      label: task.relatedRecordLabel,
    }
  }

  if (task.relatedRecordType === 'opportunity') {
    return {
      type: 'opportunity',
      id: task.relatedRecordId,
      label: task.relatedRecordLabel,
    }
  }

  if (task.relatedRecordType === 'lead') {
    return {
      type: 'lead',
      id: task.relatedRecordId,
      label: task.relatedRecordLabel,
    }
  }

  return {
    type: 'internal',
    id: task.relatedRecordId || task.id,
    label: task.relatedRecordLabel || 'Internal operations',
  }
}

export function getWorkItemParentTypeLabel(type: WorkItemParentType) {
  switch (type) {
    case 'serviceRequest':
      return 'Service Request'
    case 'project':
      return 'Project'
    case 'client':
      return 'Client'
    case 'opportunity':
      return 'Opportunity'
    case 'lead':
      return 'Lead'
    case 'internal':
      return 'Internal'
  }
}

export function getWorkItemChecklist(
  task: TaskRecord,
): WorkItemChecklistItem[] {
  return task.checklist ?? []
}

export function getWorkItemChecklistProgress(
  task: TaskRecord,
): WorkItemChecklistProgress {
  const checklist = getWorkItemChecklist(task)
  const total = checklist.length
  const completed = checklist.filter((item) => item.completed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return {
    total,
    completed,
    percent,
    label: total > 0 ? `${completed}/${total} complete` : 'No checklist',
  }
}

export function getWorkItemsForParent(
  tasks: TaskRecord[],
  parentType: WorkItemParentType,
  parentId: string,
) {
  return tasks.filter((task) => {
    const parent = getWorkItemParent(task)
    return parent.type === parentType && parent.id === parentId
  })
}

export function getStandaloneWorkItems(tasks: TaskRecord[]) {
  return tasks.filter((task) => getWorkItemParent(task).type === 'internal')
}

export function getOpenWorkItems(tasks: TaskRecord[]) {
  return tasks.filter(
    (task) => task.status !== 'Completed' && task.status !== 'Canceled',
  )
}
