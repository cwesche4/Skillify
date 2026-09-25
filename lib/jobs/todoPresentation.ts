import type { WorkItemClientRecord } from '@/lib/jobs/clientTypes'
import { OperationsPriority, WorkItemStatus } from '@/lib/prisma/enums'

export type TodoSavedView =
  | 'due-today'
  | 'overdue'
  | 'mine'
  | 'high-priority'
  | 'open'
  | 'completed'
  | 'completed-week'

export const todoSavedViews: Array<{
  id: TodoSavedView
  label: string
  tone: 'cyan' | 'rose' | 'purple' | 'amber' | 'green' | 'slate'
}> = [
  { id: 'due-today', label: 'Due Today', tone: 'purple' },
  { id: 'overdue', label: 'Overdue', tone: 'rose' },
  { id: 'mine', label: 'My To-Dos', tone: 'purple' },
  { id: 'high-priority', label: 'High Priority', tone: 'amber' },
  { id: 'open', label: 'Open', tone: 'cyan' },
  { id: 'completed', label: 'Completed', tone: 'green' },
  { id: 'completed-week', label: 'Completed This Week', tone: 'green' },
]

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function startOfLocalWeek(value: Date) {
  const start = startOfLocalDay(value)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)
  return start
}

function isSameLocalDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

export function isOpenTodo(todo: WorkItemClientRecord) {
  return (
    todo.status !== WorkItemStatus.COMPLETED &&
    todo.status !== WorkItemStatus.CANCELED
  )
}

export function matchesTodoSavedView(
  todo: WorkItemClientRecord,
  view: TodoSavedView,
  currentMemberId: string,
  now = new Date(),
) {
  if (todo.kind !== 'TODO' || todo.archivedAt) return false

  switch (view) {
    case 'due-today':
      return (
        isOpenTodo(todo) &&
        Boolean(todo.dueAt && isSameLocalDay(new Date(todo.dueAt), now))
      )
    case 'overdue':
      return (
        isOpenTodo(todo) &&
        Boolean(todo.dueAt && new Date(todo.dueAt).getTime() < now.getTime())
      )
    case 'mine':
      return todo.assigneeMemberId === currentMemberId
    case 'high-priority':
      return (
        isOpenTodo(todo) &&
        (todo.priority === OperationsPriority.HIGH ||
          todo.priority === OperationsPriority.URGENT)
      )
    case 'open':
      return isOpenTodo(todo)
    case 'completed':
      return todo.status === WorkItemStatus.COMPLETED
    case 'completed-week': {
      if (todo.status !== WorkItemStatus.COMPLETED || !todo.completedAt) {
        return false
      }
      const completedAt = new Date(todo.completedAt)
      const weekStart = startOfLocalWeek(now)
      const nextWeek = new Date(weekStart)
      nextWeek.setDate(nextWeek.getDate() + 7)
      return completedAt >= weekStart && completedAt < nextWeek
    }
  }
}

export function filterTodos(
  todos: WorkItemClientRecord[],
  view: TodoSavedView,
  currentMemberId: string,
  search: string,
  now = new Date(),
) {
  const query = search.trim().toLowerCase()
  const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as const

  return todos
    .filter((todo) => matchesTodoSavedView(todo, view, currentMemberId, now))
    .filter((todo) =>
      query
        ? [todo.title, todo.description, todo.notes]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true,
    )
    .sort((first, second) => {
      const priority =
        priorityRank[first.priority] - priorityRank[second.priority]
      if (priority) return priority
      if (first.dueAt && second.dueAt) {
        return (
          new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime()
        )
      }
      if (first.dueAt) return -1
      if (second.dueAt) return 1
      return (
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime()
      )
    })
}
