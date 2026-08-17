import { describe, expect, it } from 'vitest'

import {
  createMockWorkspaceTasks,
  type TaskRecord,
} from '@/lib/tasks/demoTasks'
import {
  getOpenWorkItems,
  getStandaloneWorkItems,
  getWorkItemChecklistProgress,
  getWorkItemParent,
  getWorkItemsForParent,
} from '@/lib/tasks/workItems'
import {
  getContextualRelatedRecords,
  getExistingRelationshipTypes,
  type ContextualRelatedRecord,
} from '@/lib/workspace-records/contextualRelatedRecords'

describe('work item helpers', () => {
  const tasks = createMockWorkspaceTasks('workspace-1')

  it('models service requests as parents with multiple work items', () => {
    const workItems = getWorkItemsForParent(
      tasks,
      'serviceRequest',
      'request-commonwealth-homepage',
    )

    expect(workItems.map((item) => item.title)).toEqual([
      'Prepare homepage emergency copy',
      'Publish approved homepage update',
    ])
  })

  it('keeps checklist items below a work item instead of top-level rows', () => {
    const workItem = tasks.find(
      (task) => task.id === 'work-item-commonwealth-homepage-content',
    )

    expect(workItem).toBeTruthy()
    expect(workItem?.checklist?.map((item) => item.title)).toEqual([
      'Review approved service list',
      'Draft emergency service hero copy',
      'Send copy for customer approval',
    ])
    expect(
      tasks.some((task) => task.id === 'commonwealth-copy-draft-hero'),
    ).toBe(false)
  })

  it('reports checklist progress for the parent work item', () => {
    const workItem = tasks.find(
      (task) => task.id === 'work-item-commonwealth-homepage-content',
    ) as TaskRecord

    expect(getWorkItemChecklistProgress(workItem)).toEqual({
      total: 3,
      completed: 2,
      percent: 67,
      label: '2/3 complete',
    })
  })

  it('supports standalone internal work items', () => {
    const standalone = getStandaloneWorkItems(tasks)

    expect(standalone.map((item) => item.id)).toContain(
      'work-item-internal-monthly-report',
    )
    expect(
      getWorkItemParent(
        standalone.find(
          (item) => item.id === 'work-item-internal-monthly-report',
        ) as TaskRecord,
      ),
    ).toMatchObject({
      type: 'internal',
      label: 'Internal operations',
    })
  })

  it('reuses the same work item model for projects', () => {
    const projectWorkItems = getWorkItemsForParent(
      tasks,
      'project',
      'project-commonwealth-refresh',
    )

    expect(projectWorkItems).toHaveLength(1)
    expect(projectWorkItems[0]).toMatchObject({
      title: 'Coordinate launch checklist',
      parentType: 'project',
    })
  })

  it('returns only incomplete work items for open-work summaries', () => {
    const openWorkItems = getOpenWorkItems(tasks)

    expect(openWorkItems.every((task) => task.status !== 'Completed')).toBe(
      true,
    )
    expect(openWorkItems.map((task) => task.id)).not.toContain(
      'task-archive-lost-opportunity',
    )
  })
})

describe('contextual related records', () => {
  const records: ContextualRelatedRecord[] = [
    {
      id: 'lead-1',
      type: 'lead',
      label: 'Lead',
      value: 'Rachel Adams',
    },
    {
      id: 'opportunity-1',
      type: 'opportunity',
      label: 'Opportunity',
      value: 'Website Refresh',
    },
    {
      id: 'sale-1',
      type: 'sale',
      label: 'Sale',
      value: 'Website Refresh Sale',
    },
    {
      id: 'client-1',
      type: 'client',
      label: 'Client',
      value: 'Commonwealth Gas & Well Service',
    },
    {
      id: 'work-item-1',
      type: 'workItem',
      label: 'Work Item',
      value: 'Prepare homepage emergency copy',
    },
  ]

  it('shows only lead-context relationships in the compact set', () => {
    const related = getContextualRelatedRecords({
      module: 'lead',
      records,
    })

    expect(related.compactRecords.map((record) => record.type)).toEqual([
      'opportunity',
      'sale',
    ])
    expect(related.explorerRecords.map((record) => record.type)).toEqual([
      'lead',
      'client',
      'workItem',
    ])
  })

  it('shows only service request relationships that actually exist', () => {
    const related = getContextualRelatedRecords({
      module: 'serviceRequest',
      records,
    })

    expect(related.compactRecords.map((record) => record.type)).toEqual([
      'client',
      'workItem',
    ])
    expect(related.compactRecords.map((record) => record.type)).not.toContain(
      'invoice',
    )
    expect(related.compactRecords.map((record) => record.type)).not.toContain(
      'estimate',
    )
  })

  it('keeps task-context relationships focused on parent and progress data', () => {
    const related = getContextualRelatedRecords({
      module: 'workItem',
      records: [
        {
          id: 'request-1',
          type: 'serviceRequest',
          label: 'Service Request',
          value: 'Update homepage',
        },
        {
          id: 'assignee-1',
          type: 'assignee',
          label: 'Assignee',
          value: 'Corbin Wesche',
        },
        {
          id: 'checklist-1',
          type: 'checklist',
          label: 'Checklist',
          value: '2/3 complete',
        },
        {
          id: 'client-1',
          type: 'client',
          label: 'Client',
          value: 'Commonwealth',
        },
      ],
    })

    expect(related.compactRecords.map((record) => record.type)).toEqual([
      'serviceRequest',
      'assignee',
      'checklist',
    ])
    expect(related.explorerRecords.map((record) => record.type)).toEqual([
      'client',
    ])
  })

  it('reports only existing relationship types for an expanded explorer', () => {
    expect(getExistingRelationshipTypes(records)).toEqual([
      'lead',
      'opportunity',
      'sale',
      'client',
      'workItem',
    ])
  })
})
