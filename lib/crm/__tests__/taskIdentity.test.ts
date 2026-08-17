import { describe, expect, it } from 'vitest'

import type { WorkspaceClient } from '@/lib/clients/types'
import type { TaskRecord } from '@/lib/tasks/demoTasks'
import { getTaskCustomerIdentity } from '@/lib/tasks/taskIdentity'

const baseTask: TaskRecord = {
  id: 'task-1',
  workspaceId: 'workspace-1',
  title: 'Replace furnace',
  status: 'Open',
  priority: 'High',
  relatedRecord: 'Furnace replacement',
  relatedType: 'Service Request',
  relatedRecordType: 'serviceRequest',
  relatedRecordId: 'request-1',
  relatedRecordLabel: 'Furnace replacement',
  parentType: 'serviceRequest',
  parentId: 'request-1',
  parentLabel: 'Furnace replacement',
  clientId: 'client-1',
  clientName: 'Fallback Client',
  dueDate: '2026-07-30',
  ownerId: 'owner-1',
  source: 'Service Request',
  createdAt: '2026-07-20',
  estimatedTime: '1 hr',
  description: 'Replace the furnace.',
  notes: '',
  timeline: [],
}

function client(overrides: Partial<WorkspaceClient>): WorkspaceClient {
  return {
    id: 'client-1',
    workspaceId: 'workspace-1',
    name: 'John Smith',
    company: 'NorthStar Electric',
    email: 'john@example.com',
    phone: '(555) 000-1000',
    status: 'Active',
    pipelineStage: 'In Progress',
    lastActivity: '2026-07-20',
    openTasks: 1,
    value: 1200,
    nextAction: 'Schedule service',
    ownerId: 'owner-1',
    health: 'Healthy',
    tags: ['Website'],
    notes: '',
    activity: [],
    tasks: [],
    suggestedAutomations: [],
    opportunity: {
      value: 1200,
      nextAction: 'Schedule service',
      probability: 70,
      expectedCloseWindow: '1 week',
    },
    ...overrides,
  }
}

describe('task customer identity', () => {
  it('prefers linked client identity and shows company only when present', () => {
    const identity = getTaskCustomerIdentity(baseTask, client({}))

    expect(identity.customerName).toBe('John Smith')
    expect(identity.companyName).toBe('NorthStar Electric')
    expect(identity.workItemSubtitle).toBe('John Smith · NorthStar Electric')
    expect(identity.parentTypeLabel).toBe('Service Request')
    expect(identity.parentLabel).toBe('Furnace replacement')
  })

  it('hides company for residential clients with no company value', () => {
    const identity = getTaskCustomerIdentity(
      {
        ...baseTask,
        title: 'Repair leaking faucet',
        parentLabel: 'Kitchen faucet leak',
        clientName: 'Sarah Johnson',
      },
      client({ name: 'Sarah Johnson', company: '' }),
    )

    expect(identity.customerName).toBe('Sarah Johnson')
    expect(identity.companyName).toBeNull()
    expect(identity.workItemSubtitle).toBe('Sarah Johnson')
    expect(identity.parentLabel).toBe('Kitchen faucet leak')
  })

  it('falls back safely when no linked client exists', () => {
    const identity = getTaskCustomerIdentity(baseTask, null)

    expect(identity.customerName).toBe('Fallback Client')
    expect(identity.companyName).toBeNull()
    expect(identity.workItemSubtitle).toBe('Fallback Client')
  })
})
