import type { TaskRecord } from '@/lib/tasks/demoTasks'
import { notifyWorkspaceCrmRecordsChanged } from '@/lib/workspace-records/previewEvents'

const STORAGE_PREFIX = 'skillify-preview-tasks'

function getPreviewTaskStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`
}

export function mergeTaskRecords(
  baseTasks: TaskRecord[],
  previewTasks: TaskRecord[],
) {
  const seen = new Set<string>()
  return [...previewTasks, ...baseTasks].filter((task) => {
    if (seen.has(task.id)) return false
    seen.add(task.id)
    return true
  })
}

export function readPreviewTasks(workspaceId: string): TaskRecord[] {
  if (typeof window === 'undefined') return []

  try {
    const value = window.sessionStorage.getItem(
      getPreviewTaskStorageKey(workspaceId),
    )
    return value ? (JSON.parse(value) as TaskRecord[]) : []
  } catch {
    return []
  }
}

export function writePreviewTasks(workspaceId: string, tasks: TaskRecord[]) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    getPreviewTaskStorageKey(workspaceId),
    JSON.stringify(tasks),
  )
  notifyWorkspaceCrmRecordsChanged(workspaceId, 'tasks')
}

export function appendPreviewTask(workspaceId: string, task: TaskRecord) {
  const nextTasks = mergeTaskRecords(readPreviewTasks(workspaceId), [task])
  writePreviewTasks(workspaceId, nextTasks)
  return nextTasks
}

export function upsertPreviewTask(workspaceId: string, task: TaskRecord) {
  const currentTasks = readPreviewTasks(workspaceId).filter(
    (record) => record.id !== task.id,
  )
  const nextTasks = [task, ...currentTasks]
  writePreviewTasks(workspaceId, nextTasks)
  return nextTasks
}

export function removePreviewTask(workspaceId: string, taskId: string) {
  const nextTasks = readPreviewTasks(workspaceId).filter(
    (task) => task.id !== taskId,
  )
  writePreviewTasks(workspaceId, nextTasks)
  return nextTasks
}
